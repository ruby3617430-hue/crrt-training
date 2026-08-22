/* ============================================================
   CRRT 模擬訓練系統｜Session / Firestore 存取共用邏輯
   需要在載入本檔案之前，先載入 firebase-app-compat.js、
   firebase-firestore-compat.js（老師端功能另需 firebase-auth-compat.js）、
   並完成 firebase.initializeApp(firebaseConfig)、alarm-config.js。
============================================================ */

const SessionStore = (function(){
  function db(){ return firebase.firestore(); }
  function FV(){ return firebase.firestore.FieldValue; }

  /* ---------------- 目前生效場次 ---------------- */
  async function getCurrentSessionId(){
    const snap = await db().collection('system').doc('currentSession').get();
    return (snap.exists && snap.data().activeSessionId) ? snap.data().activeSessionId : null;
  }

  async function getActiveSession(){
    const id = await getCurrentSessionId();
    if(!id) return null;
    const snap = await db().collection('classSessions').doc(id).get();
    if(!snap.exists || snap.data().status !== 'active') return null;
    return Object.assign({ id }, snap.data());
  }

  /* ---------------- 老師：場次管理 ---------------- */
  async function createDraftSession(sessionName, config){
    const ref = await db().collection('classSessions').add({
      sessionName: sessionName || '未命名場次',
      status: 'draft',
      createdAt: FV().serverTimestamp(),
      config: config,
      activatedConfig: null,
      activatedAt: null,
      closedAt: null
    });
    return ref.id;
  }

  async function updateDraftConfig(sessionId, config){
    await db().collection('classSessions').doc(sessionId).update({ config });
  }

  async function deleteDraftSession(sessionId){
    await db().collection('classSessions').doc(sessionId).delete();
  }

  /** 啟用場次：一個 transaction 內同時處理「關閉舊場次」＋「啟用新場次」＋更新 system/currentSession 指標，
   *  避免多老師/多分頁同時操作時產生兩個 active session。 */
  async function activateSession(sessionId){
    return db().runTransaction(async (tx) => {
      const curRef = db().collection('system').doc('currentSession');
      const curSnap = await tx.get(curRef);
      const newRef = db().collection('classSessions').doc(sessionId);
      const newSnap = await tx.get(newRef);
      if(!newSnap.exists) throw new Error('場次不存在');
      const newData = newSnap.data();

      let previousActiveId = null;
      if(curSnap.exists && curSnap.data().activeSessionId && curSnap.data().activeSessionId !== sessionId){
        previousActiveId = curSnap.data().activeSessionId;
        const oldRef = db().collection('classSessions').doc(previousActiveId);
        tx.update(oldRef, { status: 'closed', closedAt: FV().serverTimestamp() });
      }

      tx.update(newRef, {
        status: 'active',
        activatedAt: FV().serverTimestamp(),
        activatedConfig: newData.config
      });
      tx.set(curRef, { activeSessionId: sessionId });
      return { previousActiveId };
    });
  }

  /** 結束目前 active 場次。傳入 expectedSessionId（呼叫端此刻在畫面上看到的那個 active 場次 id）時，
   *  transaction 內會重新核對 system/currentSession 當下真正指向的場次是否仍是同一個，
   *  避免在 transaction 執行前後，active 場次已被其他操作（例如另一位老師切換到別的場次）變更，
   *  導致誤關閉一個其實已經不是目前生效場次的場次、或誤清除別人剛設定好的 activeSessionId。 */
  async function closeActiveSession(expectedSessionId){
    return db().runTransaction(async (tx) => {
      const curRef = db().collection('system').doc('currentSession');
      const curSnap = await tx.get(curRef);
      const currentActiveId = (curSnap.exists && curSnap.data().activeSessionId) ? curSnap.data().activeSessionId : null;

      if(!currentActiveId){
        return { closed: false, reason: 'no-active-session' };
      }
      if(expectedSessionId && currentActiveId !== expectedSessionId){
        throw new Error('此場次已不是目前生效場次，可能已被其他操作異動，請重新整理後再試。');
      }

      const sessRef = db().collection('classSessions').doc(currentActiveId);
      tx.update(sessRef, { status: 'closed', closedAt: FV().serverTimestamp() });
      tx.set(curRef, { activeSessionId: null });
      return { closed: true, sessionId: currentActiveId };
    });
  }

  async function listAllSessions(){
    const snap = await db().collection('classSessions').orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
  }

  /** 平衡出題：「讀取候選 counters → 比較最小值 → 並列隨機 → 選定 → assignedCount +1」
   *  整段決策與寫入都在同一個 Firestore Transaction 內完成。Firestore transaction 的機制是：
   *  若 commit 前，這個 transaction 讀取過的任一文件被其他 transaction 搶先修改，本次 transaction
   *  會自動整段重試（重新讀取最新資料、重新比較、重新選定），因此保護的是「選擇」這個決策本身，
   *  不是只保護遞增這個動作——兩個同時發生的呼叫不會依據同一份舊資料做出相同選擇。 */
  async function pickBalancedFromCounters(counterColRef, candidateIds){
    return db().runTransaction(async (tx) => {
      const refs = candidateIds.map(id => counterColRef.doc(id));
      const snaps = await Promise.all(refs.map(r => tx.get(r)));
      const counts = snaps.map((s, i) => ({
        id: candidateIds[i], ref: refs[i],
        exists: s.exists, count: s.exists ? (s.data().assignedCount || 0) : 0
      }));
      const minCount = Math.min(...counts.map(c => c.count));
      const pool = counts.filter(c => c.count === minCount);
      const pick = pool[Math.floor(Math.random() * pool.length)];

      if(pick.exists){
        tx.update(pick.ref, { assignedCount: pick.count + 1 });
      } else {
        tx.set(pick.ref, { assignedCount: 1 });
      }
      return pick.id;
    });
  }

  function shuffleArr(arr){ return [...arr].sort(() => Math.random() - 0.5); }

  /** 依 session.activatedConfig 產生本次正式挑戰的題目計畫：
   *  [{ alarmId, causeId }, ...]，已完成核心題+隨機池平衡抽題+最終洗牌。 */
  async function buildChallengeQuestionPlan(session){
    const cfg = session.activatedConfig;
    const coreIds = (cfg.selectedCoreAlarmIds || []).slice();
    const randomCount = Math.max(0, cfg.totalQuestions - coreIds.length);
    const alarmCounterCol = db().collection('classSessions').doc(session.id).collection('alarmCounters');
    const scenarioCounterCol = db().collection('classSessions').doc(session.id).collection('scenarioCounters');

    let pool = (cfg.selectedRandomAlarmIds || []).slice();
    const chosenRandom = [];
    for(let i = 0; i < randomCount; i++){
      if(pool.length === 0) break;
      const picked = await pickBalancedFromCounters(alarmCounterCol, pool);
      chosenRandom.push(picked);
      pool = pool.filter(id => id !== picked);
    }

    const allAlarmIds = shuffleArr(coreIds.concat(chosenRandom));
    const plan = [];
    for(const alarmId of allAlarmIds){
      const def = alarmDefs[alarmId];
      if(!def) continue;
      const causeIds = def.causes.map(c => c.id);
      const scenarioKeyIds = causeIds.map(cid => alarmId + '__' + cid);
      const pickedKey = await pickBalancedFromCounters(scenarioCounterCol, scenarioKeyIds);
      const causeId = pickedKey.slice((alarmId + '__').length);
      plan.push({ alarmId, causeId });
    }
    return plan;
  }

  /* ---------------- 寫入挑戰結果 ---------------- */
  async function submitChallenge(session, playerName, totalScore, totalQuestions, questions){
    const challengeRef = db().collection('classSessions').doc(session.id).collection('challenges').doc();
    const summaryRef = db().collection('classSessions').doc(session.id).collection('publicSummaries').doc(challengeRef.id);
    const batch = db().batch();
    const createdAt = FV().serverTimestamp();
    batch.set(challengeRef, {
      sessionId: session.id, playerName, createdAt, totalScore, totalQuestions, questions
    });
    batch.set(summaryRef, { playerName, totalScore, totalQuestions, createdAt });
    await batch.commit();
    return challengeRef.id;
  }

  /* ---------------- 老師端：讀取與統計 ---------------- */
  async function loadAllChallenges(sessionId){
    const snap = await db().collection('classSessions').doc(sessionId).collection('challenges').get();
    return snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
  }

  async function loadPublicSummaries(sessionId){
    const snap = await db().collection('classSessions').doc(sessionId).collection('publicSummaries')
      .orderBy('totalScore', 'desc').get();
    return snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
  }

  const TOP3_MIN_SAMPLE = 5;

  /** 統計完全由不可竄改的 challenges 明細現場計算，不依賴任何前端維護的聚合統計文件。 */
  function computeStats(challenges){
    const scenarioStats = {};
    const errorApplicable = {}; // concept -> Set(key)
    const errorErrored = {};    // concept -> Set(key)
    const errorEventCount = {}; // concept -> number
    const hrQuestionSet = {}; const hrEventCount = {}; const hrLearners = {};

    challenges.forEach(ch => {
      (ch.questions || []).forEach((q, qi) => {
        const key = ch.id + ':' + qi;
        if(!scenarioStats[q.scenarioId]){
          scenarioStats[q.scenarioId] = {
            alarmName: q.alarmName, scenarioText: q.scenarioText, correctAnswer: q.correctAnswer,
            teachingPoint: q.teachingPoint, assignedCount: 0, completedCount: 0,
            correctCount: 0, incorrectCount: 0, timeoutCount: 0, wrongAnswerTally: {}
          };
        }
        const st = scenarioStats[q.scenarioId];
        st.assignedCount++;
        if(q.timeout){
          st.timeoutCount++;
        } else if(q.completed){
          const hadError = (q.errorEvents || []).length > 0;
          st.completedCount++;
          if(hadError){
            st.incorrectCount++;
            (q.errorEvents || []).forEach(ev => {
              st.wrongAnswerTally[ev.selectedAction] = (st.wrongAnswerTally[ev.selectedAction] || 0) + 1;
            });
          } else {
            st.correctCount++;
          }
        }

        if(q.completed && !q.timeout){
          (q.applicableErrorConcepts || []).forEach(concept => {
            (errorApplicable[concept] = errorApplicable[concept] || new Set()).add(key);
          });
          const seenConcepts = new Set();
          const hrKeysThisQ = new Set();
          (q.errorEvents || []).forEach(ev => {
            if(ev.errorConcept){
              errorEventCount[ev.errorConcept] = (errorEventCount[ev.errorConcept] || 0) + 1;
              if(!seenConcepts.has(ev.errorConcept)){
                seenConcepts.add(ev.errorConcept);
                (errorErrored[ev.errorConcept] = errorErrored[ev.errorConcept] || new Set()).add(key);
              }
            }
            if(ev.highRisk){
              const hrKey = ev.errorConcept + '::' + ev.selectedAction;
              hrEventCount[hrKey] = (hrEventCount[hrKey] || 0) + 1;
              hrKeysThisQ.add(hrKey);
            }
          });
          hrKeysThisQ.forEach(hrKey => {
            (hrQuestionSet[hrKey] = hrQuestionSet[hrKey] || new Set()).add(key);
            (hrLearners[hrKey] = hrLearners[hrKey] || new Set()).add(ch.playerName);
          });
        }
      });
    });

    const errorConceptResult = Object.keys(errorApplicable).map(concept => {
      const applicable = errorApplicable[concept].size;
      const errored = (errorErrored[concept] || new Set()).size;
      return {
        concept, label: (ERROR_CONCEPTS[concept] || {}).label || concept,
        applicableAttemptCount: applicable, erroredAttemptCount: errored,
        eventCount: errorEventCount[concept] || 0,
        errorRate: applicable > 0 ? errored / applicable : 0
      };
    }).filter(r => r.applicableAttemptCount >= TOP3_MIN_SAMPLE)
      .sort((a, b) => b.errorRate - a.errorRate || b.erroredAttemptCount - a.erroredAttemptCount || b.applicableAttemptCount - a.applicableAttemptCount)
      .slice(0, 3);

    const highRiskResult = Object.keys(hrQuestionSet).map(hrKey => {
      const sepIdx = hrKey.indexOf('::');
      const concept = hrKey.slice(0, sepIdx), action = hrKey.slice(sepIdx + 2);
      return {
        key: hrKey, action, concept, label: (ERROR_CONCEPTS[concept] || {}).label || concept,
        eventCount: hrEventCount[hrKey] || 0,
        questionCount: hrQuestionSet[hrKey].size,
        uniqueLearnerCount: hrLearners[hrKey].size
      };
    }).sort((a, b) => b.questionCount - a.questionCount);

    return { scenarioStats, errorConceptResult, highRiskResult, top3MinSample: TOP3_MIN_SAMPLE };
  }

  return {
    getCurrentSessionId, getActiveSession,
    createDraftSession, updateDraftConfig, deleteDraftSession,
    activateSession, closeActiveSession, listAllSessions,
    buildChallengeQuestionPlan, submitChallenge,
    loadAllChallenges, loadPublicSummaries, computeStats
  };
})();
