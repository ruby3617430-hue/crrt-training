/* ============================================================
   CRRT 模擬訓練系統｜共用警報資料設定檔
   唯一的 alarmDefs 事實來源，供 crrt_game.html、crrt_demo_mode.html、
   crrt_leaderboard.html（老師端統計計算）共同讀取。

   新增警報步驟：
   1. 在 alarmDefs 新增一個 alarmId 物件，照現有格式填寫
   2. 若有新的錯誤類型，先在 ERROR_CONCEPTS 補上定義，並在該情境的
      applicableErrorConcepts 陣列列出所有「這一題有機會犯的錯誤類型」
   3. 存檔即可，四個頁面都會自動讀到；正式挑戰是否使用這個新警報，
      由老師登入排行榜頁後，在「本梯正式挑戰設定」勾選（預設不會自動出現
      在正在進行中的場次，需老師手動加入新場次的設定）
============================================================ */

/* ---- 按鍵操作錯誤（面板按鍵誤按，各警報通用） ---- */
const BUTTON_ERROR_DEFS = {
  stop:     { errorConcept:'premature-stop',     highRisk:false, label:'停止',       teachingPoint:'停止鍵只在特定合法流程步驟才是正確操作，其餘任何時機按下都嚴禁使用，因為會直接終止治療。' },
  continue: { errorConcept:'premature-continue', highRisk:false, label:'繼續',       teachingPoint:'必須先完成正確的原因判斷與處置，才能按下繼續鍵恢復運轉，跳過判斷直接按繼續可能讓警報原因未被真正排除。' },
  ignore:   { errorConcept:'premature-continue', highRisk:false, label:'忽略',       teachingPoint:'必須先完成正確的情境判斷，才能按下忽略鍵，跳過判斷可能讓真正的血液滲漏未被處理。' },
  release:  { errorConcept:'premature-release',  highRisk:false, label:'鬆開管路夾', teachingPoint:'鬆開管路夾前應先確認回輸端問題已排除，過早釋放壓力可能無法真正解決警報原因。' },
  flow:     { errorConcept:'premature-flow',     highRisk:false, label:'流速設定',   teachingPoint:'流速設定需要在正確的處置順序中使用，過早或跳過使用都不符合標準流程。' }
};

/* ---- 錯誤觀念分類定義（供老師端統計顯示中文名稱與說明） ---- */
const ERROR_CONCEPTS = {
  'end-confusion':        { label:'輸入／回輸端判讀錯誤',       description:'混淆警報實際發生的管路端（輸入端/回輸端），檢查了錯誤的一側。' },
  'unsafe-return':        { label:'血塊阻塞仍嘗試安全回血',     description:'管路已明顯凝血阻塞的情況下，仍選擇執行回血，可能造成栓塞風險。' },
  'scenario-mismatch':     { label:'情境判斷錯誤',              description:'選擇了同一警報底下、對應其他情境的正確處置，未能正確連結當下的情境線索。' },
  'color-shape-mismatch': { label:'磅秤顏色／形狀判讀錯誤',     description:'未正確判讀畫面上的顏色或形狀圖示，選擇了錯誤的磅秤。' },
  'premature-stop':       { label:'過早／不當使用停止鍵',       description:'尚未走到合法流程步驟就按下停止鍵。' },
  'premature-continue':   { label:'未完成判斷即恢復運轉',       description:'尚未完成正確的原因判斷與處置，就按下繼續／忽略鍵。' },
  'premature-release':    { label:'鬆開管路夾操作時機錯誤',     description:'尚未確認原因排除就按下鬆開管路夾鍵。' },
  'premature-flow':       { label:'流速設定操作順序錯誤',       description:'流速設定按鍵使用的時機或順序不符合標準流程。' }
};

const alarmDefs = {
  'access-low': {
    alarmId:'access-low', enabled:true, eligibleAsCore:true,
    defaultWrongErrorConcept:'scenario-mismatch',
    title:'警告：輸入壓極度負值', tag:'Access Pressure Low ｜已核對機台實拍畫面',
    date:'04/December/17', time:'13:50',
    instructions:{
      selfclear:'無法完成自我清除。', pre:null,
      actions:[
        '確認輸入管未被夾住，亦未因病人行動而有拗折或被阻礙。',
        '根據導管大小評估血流；如有需要，請按【流速設定】降低血液流速。',
        '輸入壓回復正常後，請按【繼續】清除警報。'
      ],
      otherCauses:null,
      help:'請參閱 [幫助]，了解更多疑難排解及其他可能原因。'
    },
    gauges:[
      { name:'輸入', value:-333, min:-250, max:450, redLeft:-216, redRight:300 },
      { name:'過濾器', value:2, min:-450, max:450, redLeft:10, redRight:430 },
      { name:'廢液', value:-16, min:-500, max:500 },
      { name:'回輸', value:20, min:10, max:350, redLeft:25, redRight:200 }
    ],
    metrics:{ drop:-3, tmp:-9 },
    hasRelease:false,
    fixGauge:{ index:0, value:-95 },
    steps:['mute','diagnose','resume'],
    causes:[
      { id:'kink', scenarioId:'access-low-kink', cue:'剛協助病人翻身，拉起床欄時夾到輸入端管路（紅）。',
        correct:'kink', resolveText:'檢查並排除輸入端管路（紅）被夾住／拗折的情形後，輸入壓逐漸回升。',
        applicableErrorConcepts:['scenario-mismatch','end-confusion','premature-stop','premature-continue'] },
      { id:'lumen', scenarioId:'access-low-lumen', cue:'床邊觀察：使用 20mL 空針抽吸導管時感覺有阻力，懷疑 Double Lumen 前端貼附血管壁。',
        correct:'lumen', resolveText:'調整病人姿勢、Double Lumen 位置，並照會洗腎室護理師評估是否可紅藍端對調後，輸入壓恢復正常。',
        applicableErrorConcepts:['scenario-mismatch','end-confusion','premature-stop','premature-continue'] },
      { id:'volume', scenarioId:'access-low-volume', cue:'生命徵象：血壓 82/50 mmHg，懷疑病人容積不足。',
        correct:'volume',
        resolveText:'先連絡洗腎室護理師評估是否可調降血液流速至最低 100 ml/min（待血壓改善後需調回 150-200 ml/min），讓機器先運轉，避免套組凝血。處理完畢後按面板【繼續】鍵，後續仍須處理血壓，請醫師評估調降脫水量、調整升壓藥物、輸血或輸液，提升病人血液容積。',
        finalSequence:[
          { type:'button', which:'flow' },
          { type:'confirm', label:'已調降流速至 100 ml/min' },
          { type:'button', which:'continue' },
          { type:'confirm', label:'處理血壓，請醫師評估調降脫水量，調整升壓劑、輸血或輸液，提升病人血液容積。' }
        ],
        applicableErrorConcepts:['scenario-mismatch','end-confusion','premature-stop','premature-continue','premature-flow'] }
    ],
    actionOptions:[
      { id:'kink', label:'檢查輸入端管路（紅）是否被夾住或拗折，並協助排除' },
      { id:'lumen', label:'調整病人姿勢、Double Lumen 位置，或請洗腎室護理師評估是否可紅、藍端對調' },
      { id:'volume', label:'先連絡洗腎室護理師評估是否可調降血液流速至最低 100 ml/min（待血壓改善後需調回 150-200 ml/min），讓機器先運轉，避免套組凝血' },
      { id:'wrong-return', label:'檢查回輸端（藍）管路是否阻塞', errorConcept:'end-confusion', highRisk:false }
    ]
  },

  'return-high': {
    alarmId:'return-high', enabled:true, eligibleAsCore:true,
    defaultWrongErrorConcept:'scenario-mismatch',
    title:'警告：回輸壓極度正值', tag:'Return Pressure High ｜已核對機台實拍畫面',
    date:'04/December/17', time:'14:21',
    instructions:{
      selfclear:'無法完成自我清除。', pre:'請按下列指示進行。',
      actions:[
        '確認回輸管未被夾住，亦未因病人行動而有拗折或被阻礙。',
        '評估病人與導管的位置；視需要加以修正。',
        '請按 [鬆開管路夾]，釋放回輸管中過多的壓力。',
        '如有需要，請利用 [流速設定] 降低血液流速。',
        '請按 [繼續]。'
      ],
      otherCauses:'回輸導管內有凝血，或偏移原本靜脈血管位置；病人正在移動，或有人正在搬動病人；病人正在咳嗽，或有人幫他抽痰；血液流速過高；液體屏障已潮濕。',
      help:null
    },
    gauges:[
      { name:'輸入', value:20, min:-250, max:300, redLeft:-100, redRight:150 },
      { name:'過濾器', value:385, min:-500, max:450, redRight:430 },
      { name:'廢液', value:383, min:-500, max:500 },
      { name:'回輸', value:390, min:-500, max:350, redRight:300 }
    ],
    metrics:{ drop:-30, tmp:-14 },
    hasRelease:true,
    fixGauge:{ index:3, value:210 },
    steps:['mute','diagnose','release','resume'],
    causes:[
      { id:'kink', scenarioId:'return-high-kink', cue:'洗腎室護理師將 CRRT 管路與病人 Double Lumen 導管接上後，CRRT 機器開始運轉沒多久就發出警報聲。',
        correct:'kink', resolveText:'檢查並排除回輸端管路（藍）被夾住／拗折的情形後，按【鬆開管路夾】釋放壓力，確認回輸壓下降後按【繼續】，回輸壓逐漸下降。',
        finalSequence:[ { type:'button', which:'release' }, { type:'button', which:'continue' } ],
        applicableErrorConcepts:['scenario-mismatch','end-confusion','premature-stop','premature-continue','premature-release'] },
      { id:'clot', scenarioId:'return-high-clot', cue:'CRRT 機器發出警報，巡視管路時發現排氣室出現暗紅色血塊。',
        correct:'clot', resolveText:'確認排氣室嚴重凝血已影響運作，按【停止】，處理透析導管，等待洗腎室護理師更換套組，回輸壓恢復正常。',
        finalSequence:[
          { type:'button', which:'stop' },
          { type:'confirm', label:'嚴重凝血不回血，處理透析導管，等待洗腎室護理師更換套組' }
        ],
        applicableErrorConcepts:['scenario-mismatch','end-confusion','premature-stop','premature-continue','premature-release'] },
      { id:'lumen', scenarioId:'return-high-lumen', cue:'用 20mL 空針反抽 Double Lumen 及生理食鹽水沖水皆不順暢。',
        correct:'lumen', resolveText:'確診 Double Lumen 不順暢，按【停止】，評估管路阻塞無法回血，處理透析導管，等待醫師更換 Double Lumen 導管，回輸壓恢復正常。',
        finalSequence:[
          { type:'button', which:'stop' },
          { type:'confirm', label:'評估管路阻塞無法回血，處理透析導管，等待醫師更換 Double Lumen 導管' }
        ],
        applicableErrorConcepts:['scenario-mismatch','end-confusion','premature-stop','premature-continue','premature-release'] },
      { id:'cough', scenarioId:'return-high-cough', cue:'協助抽痰時病人劇烈咳嗽後警報。',
        correct:'cough', resolveText:'待病人平靜後，按【鬆開管路夾】評估壓力是否下降（面板回輸壓箭頭回復至灰色區間顯示已下降），確認下降後按【繼續】，回輸壓回到安全範圍。',
        finalSequence:[ { type:'button', which:'release' }, { type:'button', which:'continue' } ],
        applicableErrorConcepts:['scenario-mismatch','end-confusion','premature-stop','premature-continue','premature-release'] }
    ],
    actionOptions:[
      { id:'kink', label:'檢查回輸端管路（藍）是否被夾住或拗折，並協助排除' },
      { id:'clot', label:'若排氣室嚴重凝血已影響運作，請洗腎室護理師協助更換套組' },
      { id:'lumen', label:'醫師評估需更換 Double Lumen 導管' },
      { id:'cough', label:'待病人平靜後，確認回輸壓力是否下降（面板回輸壓箭頭回復至灰色區間顯示已下降）' },
      { id:'wrong-input', label:'檢查輸入端（紅）管路是否阻塞', errorConcept:'end-confusion', highRisk:false }
    ]
  },

  'filter-clot': {
    alarmId:'filter-clot', enabled:true, eligibleAsCore:false,
    defaultWrongErrorConcept:'scenario-mismatch',
    title:'警告：過濾器已凝血', tag:'Filter Clotted ｜已核對機台實拍畫面',
    date:'04/December/17', time:'15:10',
    instructions:{
      selfclear:'過濾器內有血液凝塊形成。請按 [停止] 並更換套組。', pre:null,
      actions:[],
      otherCauses:'血流途徑內有被夾住的管路；置換液、PBP 或病人脫水速率過高；注射器未正確安裝；注射器幫浦故障。',
      help:null
    },
    gauges:[
      { name:'輸入', value:-104, min:-250, max:300,
        bands:[{end:-180,color:'red'},{end:-140,color:'yellow'},{end:100,color:'green'},{end:180,color:'yellow'},{end:300,color:'red'}] },
      { name:'過濾器', value:433, min:10, max:450,
        bands:[{end:250,color:'red'},{end:440,color:'green'},{end:450,color:'red'}] },
      { name:'廢液', value:-70, min:-500, max:500,
        bands:[{end:500,color:'green'}] },
      { name:'回輸', value:122, min:10, max:450,
        bands:[{end:100,color:'red'},{end:200,color:'green'},{end:350,color:'yellow'},{end:450,color:'red'}] }
    ],
    metrics:{ drop:308, tmp:316 },
    hasRelease:false,
    fixGauge:{ index:1, value:200 },
    steps:['mute','diagnose','resume'],
    causes:[
      { id:'severe-clot', scenarioId:'filter-clot-severe-clot', cue:'巡視管路時發現過濾器與排氣室出現暗紅色凝血塊，TMP 持續上升，確認已凝血且管路已有血塊阻塞。',
        correct:'severe-clot', resolveText:'血塊已阻塞、無法安全回血，不執行回血動作，按【停止】，處理透析導管並聯絡洗腎室護理師更換套組，TMP 恢復正常。',
        finalSequence:[
          { type:'button', which:'stop' },
          { type:'confirm', label:'處理透析導管並聯絡洗腎室護理師更換套組' }
        ],
        applicableErrorConcepts:['scenario-mismatch','unsafe-return','premature-stop','premature-continue'] }
    ],
    actionOptions:[
      { id:'severe-clot', label:'血塊已阻塞、無法安全回血，不執行回血動作，準備更換套組' },
      { id:'wrong-force-return', label:'套組已明顯凝血阻塞，執行回血', penalty:-3, errorConcept:'unsafe-return', highRisk:true }
    ]
  },

  'bag-empty': {
    alarmId:'bag-empty', enabled:true, eligibleAsCore:false,
    defaultWrongErrorConcept:'color-shape-mismatch',
    title:'注意: 液袋已空', tag:'Bag Empty ｜已核對機台實拍畫面', severity:'notice', audioTrack:'notice',
    date:'04/December/17', time:'16:50',
    instructions:{
      selfclear:null, pre:'如要更換置換液袋，請執行下列步驟。',
      actions:[
        '打開磅秤，夾住液袋和管路，再取下液袋。',
        '將新液袋連接到管路，鬆開液袋和管路，然後關上磅秤。',
        '準備就緒後，請按 [繼續]。'
      ],
      otherCauses:'液袋另有支撐力。',
      help:null
    },
    rightPanelType:'octagon',
    hasRelease:false,
    steps:['mute','diagnose','resume'],
    causes:[
      { id:'purple', scenarioId:'bag-empty-purple', color:'#a31f6b', shape:'octagon', cue:'',
        correct:'purple', resolveText:'打開紫色磅秤，關閉液袋管夾、取下空液袋，接上新液袋後鬆開管夾並關閉磅秤，按【繼續】，警示解除。',
        applicableErrorConcepts:['color-shape-mismatch','premature-stop','premature-continue'] },
      { id:'white', scenarioId:'bag-empty-white', color:'#ffffff', shape:'triangle', cue:'',
        correct:'white', resolveText:'打開白色磅秤，關閉液袋管夾、取下空液袋，接上新液袋後鬆開管夾並關閉磅秤，按【繼續】，警示解除。',
        applicableErrorConcepts:['color-shape-mismatch','premature-stop','premature-continue'] },
      { id:'green', scenarioId:'bag-empty-green', color:'#4f7942', shape:'square', cue:'',
        correct:'green', resolveText:'打開綠色磅秤，關閉液袋管夾、取下空液袋，接上新液袋後鬆開管夾並關閉磅秤，按【繼續】，警示解除。',
        applicableErrorConcepts:['color-shape-mismatch','premature-stop','premature-continue'] }
    ],
    actionOptions:[
      { id:'purple', label:'打開紫色磅秤，依步驟更換置換液袋' },
      { id:'white', label:'打開白色磅秤，依步驟更換置換液袋' },
      { id:'green', label:'打開綠色磅秤，依步驟更換置換液袋' }
    ]
  },

  'flow-problem': {
    alarmId:'flow-problem', enabled:true, eligibleAsCore:true,
    defaultWrongErrorConcept:'color-shape-mismatch',
    title:'注意: 流動上的問題', tag:'Flow Problem ｜已核對機台實拍畫面', severity:'notice', audioTrack:'notice',
    date:'10/August/17', time:'22:31',
    rightPanelType:'octagon', badgeColor:'#c2287a',
    instructions:{
      selfclear:'並未按照預估的流速注射置換溶液。', pre:null,
      actionsHeading:'檢查並確認以下事項:',
      actions:[
        '易碎栓已完全弄斷（如適用的話）。',
        '管路夾已開；管路沒有拗折。',
        '液體袋並未晃動亦未另有支撐力。',
        '必要管路均已連結，並無滲漏。液袋接頭已拴緊。'
      ],
      note:'解決狀況後再按 [繼續]。',
      otherCauses:'磅秤故障；非閉塞式幫浦。（請參閱操作手冊的「疑難排解」）。',
      help:null
    },
    hasRelease:false,
    fixGauge:null,
    steps:['mute','diagnose','resume'],
    causes:[
      { id:'after-bag-change', scenarioId:'flow-problem-after-bag-change', color:'#a31f6b', shape:'octagon', cue:'更換完液袋後隨即發出警告。',
        correct:'after-bag-change', resolveText:'檢查紫色磅秤：檢視更換液袋後管夾已正確開啟、管路無拗折、液袋接頭已正確旋緊無歪斜，再按【繼續】，警示解除。',
        applicableErrorConcepts:['color-shape-mismatch','premature-stop','premature-continue'] },
      { id:'turning', scenarioId:'flow-problem-turning', color:'#ffffff', shape:'triangle', cue:'協助病人翻身後隨即發出警告，管路因翻身晃動影響液體袋。',
        correct:'turning', resolveText:'檢查白色磅秤，管路因翻身晃動影響液體袋，盡快完成翻身，結束後按【繼續】，警示解除。',
        applicableErrorConcepts:['color-shape-mismatch','premature-stop','premature-continue'] },
      { id:'drain', scenarioId:'flow-problem-drain', color:'#f2c744', shape:'circle', cue:'引流完廢液後隨即發出警告。',
        correct:'drain', resolveText:'檢查黃色磅秤：檢視廢液袋管路管夾是否正確開啟，再按【繼續】，警示解除。',
        applicableErrorConcepts:['color-shape-mismatch','premature-stop','premature-continue'] },
      { id:'moving', scenarioId:'flow-problem-moving', color:'#4f7942', shape:'square', cue:'協助病人翻身時挪動 CRRT 機器隨即發出警告，加溫管線及液體袋有晃動情形。',
        correct:'moving', resolveText:'檢查綠色磅秤，液袋是否有晃動情形，並於挪動機器前先按【更換液袋】按鈕，挪動後確實固定加溫管線避免懸吊於液袋上，再按【繼續】，警示解除。',
        applicableErrorConcepts:['color-shape-mismatch','premature-stop','premature-continue'] }
    ],
    actionOptions:[
      { id:'after-bag-change', label:'檢查紫色磅秤：管夾是否正確開啟、管路無拗折、液袋接頭已正確旋緊' },
      { id:'turning', label:'檢查白色磅秤：盡快完成翻身' },
      { id:'drain', label:'檢查黃色磅秤：廢液袋管路管夾是否正確開啟' },
      { id:'moving', label:'檢查綠色磅秤：液袋是否有晃動情形，並於挪動機器前先按【更換液袋】按鈕，挪動後確實固定加溫管線避免懸吊於液袋上' }
    ]
  },

  'blood-leak': {
    alarmId:'blood-leak', enabled:true, eligibleAsCore:true,
    defaultWrongErrorConcept:'scenario-mismatch',
    title:'警告: 偵測到血液滲漏', tag:'Blood Leak Detected ｜已核對機台實拍畫面',
    date:'04/December/17', time:'16:11',
    rightPanelType:'none', resumeLabel:'忽略',
    instructions:{
      selfclear:null, pre:null,
      actionsHeading:'動作:',
      actions:[
        '檢查廢液袋是否變色。相關指示請參閱 [幫助]。',
        '按 [忽略]。請密切監控。會忽略警報達 2 分鐘。',
        '如果警報仍未清除，請按 [停止] 並更換套組。'
      ],
      note:null,
      warningNote:'如果重新調整了血液滲漏偵測器中的廢液管路，請在警報清除後按 [系統工具] 畫面中的 [正常化 BLD] 並按照指示進行。',
      otherCauses:null,
      help:'請參閱 [幫助]，了解更多疑難排解及其他可能原因。'
    },
    hasRelease:false,
    steps:['mute','diagnose'],
    causes:[
      { id:'leak', scenarioId:'blood-leak-leak', cue:'檢查廢液管路（黃色）呈鮮紅色。',
        correct:'leak', resolveText:'確認過濾器半透膜破裂造成血液滲漏，按【停止】，將 Double Lumen 封管並聯絡洗腎室護理師更換套組。',
        finalSequence:[
          { type:'button', which:'stop' },
          { type:'confirm', label:'過濾器半透膜破裂，將 Double Lumen 封管並聯絡洗腎室護理師更換套組' }
        ],
        applicableErrorConcepts:['scenario-mismatch','premature-stop','premature-continue'] },
      { id:'rhabdo', scenarioId:'blood-leak-rhabdo', cue:'檢查廢液管路（黃色）呈茶色，病人有橫紋肌溶解症病史。',
        correct:'rhabdo', resolveText:'評估屬橫紋肌溶解症之正常茶色廢液表現，按【忽略】，繼續治療並密切監控。',
        applicableErrorConcepts:['scenario-mismatch','premature-stop','premature-continue'] },
      { id:'lamp', scenarioId:'blood-leak-lamp', cue:'檢查廢液管路（黃色）呈清澈，病人有使用烤燈，機器面對窗戶。',
        correct:'lamp', resolveText:'評估烤燈位置或拉上窗簾，避免光線直接照射到機器偵測器後，按【忽略】，繼續治療。',
        applicableErrorConcepts:['scenario-mismatch','premature-stop','premature-continue'] }
    ],
    actionOptions:[
      { id:'leak', label:'評估為過濾器半透膜破裂，造成血液滲漏' },
      { id:'rhabdo', label:'評估屬橫紋肌溶解症之正常茶色廢液表現' },
      { id:'lamp', label:'評估烤燈照射或窗戶陽光干擾偵測器，需調整烤燈位置或拉上窗簾' }
    ]
  }
};

const scenarios = [
  { id:'access-low', unlocked:true },
  { id:'return-high', unlocked:true },
  { id:'bag-empty', unlocked:true },
  { id:'flow-problem', unlocked:true },
  { id:'filter-clot', unlocked:true },
  { id:'blood-leak', unlocked:true }
];
