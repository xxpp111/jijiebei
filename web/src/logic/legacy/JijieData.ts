// [legacy/web 副本] 源 = assets/Script/jijie2/JijieData.ts（XP/Cocos 知识成果，原件只读保留，致敬原作者）。
// 纯静态状态容器，逐字复制、无逻辑改动；web 运行期单例状态板。详见同目录 README.md。

export default class JijieData {
    //比赛选手
    public static playerName: string;

    /**
     * 状态 -1:loading 0:初始 1:选择模式 2:选择因子 3:开始 4:结束记录
     */
    public static status: number;

    //地图顺序
    public static  mapList: string[];

    //锁定因子
    public static  lockFactorList: string[];

    //已选择的模式
    public static  modeIsRandom: boolean;
    //已选择的难度 基础因子数 最后一场+1
    public static  modelFactorCount: number;
    //已选择的模式
    public static  modeIsOnePick: boolean;
    //是否极难模式
    public static  modeIsVeryHard: boolean;
    //是否极难模式
    public static  modeIsVeryHard2: boolean;
    //是否拯救模式
    public static  modeIsZhengjiu: boolean;
    //是否篮字模式
    public static  modeIsLanzi: boolean;

    public static  modeFeiqiu: boolean;
    public static  modeSuiji: boolean;
    public static  modeStd15: boolean; // 15 因子纯随机模式（每场 5，无锁定无手选）
    public static  modeZhenghuo: boolean;

    //因子池
    public static  randomFactorPoor: string[];

    //指挥官池A
    public static  randomCommanderPoorA: string[];

    //指挥官池B
    public static  randomCommanderPoorB: string[];

    //指挥官池C
    public static  randomCommanderPoorC: string[];

    //已选择的因子
    public static  selectedFactorList: string[];

    //已选择的指挥官
    public static  selectedCommanderList: string[];

    //胜负信息  0:失败 1:胜利 2:带奖励
    public static  winLoseList: number[];

    public static  winCount: number;
    public static  winbCount: number;
    public static  totalCount: number;

    public static  pickBCount: number;
    public static  pickACount: number;

    public static reset() {
        this.modeFeiqiu = false;
        this.modeSuiji = false;
        this.modeStd15 = false;
        this.modeIsRandom = false;
        this.modeIsOnePick = false;
        this.modeIsVeryHard = false;
        this.modeIsZhengjiu = false;
        this.modeIsLanzi = false;
        this.modeZhenghuo = false;
        this.modeIsVeryHard2 = false;
    }

    public static initStart(): void {
        this.playerName = null;
        this.status = 0;
        this.mapList = [];
        this.lockFactorList = [];
        this.randomFactorPoor = [];
        this.randomCommanderPoorA = [];
        this.randomCommanderPoorB = [];
        this.randomCommanderPoorC = [];
        this.selectedFactorList = [];
        this.selectedCommanderList = [];
        this.winLoseList = [];

        this.winCount = 0;
        this.winbCount = 0;
        this.totalCount = 0;

        this.pickBCount = 0;
        this.pickACount = 0;
    }
}
