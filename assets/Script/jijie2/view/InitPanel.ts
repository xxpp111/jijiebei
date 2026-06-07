import JijieControl from "../JijieContro";
import JijieData from "../JijieData";

const { ccclass, property } = cc._decorator;

@ccclass
export default class InitPanel extends cc.Component {
    @property(cc.EditBox)
    public txtName: cc.EditBox = null;
    @property(cc.Node)
    public btnStart2: cc.Node = null;
    @property(cc.Node)
    public btnStart3: cc.Node = null;
    @property(cc.Node)
    public btnStart13: cc.Node = null;
    @property(cc.Node)
    public btnStart4: cc.Node = null;
    @property(cc.Node)
    public btnOneCommanderA: cc.Node = null;
    //	public  btnOneCommanderB:cc.Node = null;
    @property(cc.Node)
    public btnStartHard: cc.Node = null;
    @property(cc.Node)
    public btnStartHard2: cc.Node = null;
    // @property(cc.Node)
    // public btnStartLushi: cc.Node = null;
    // @property(cc.Node)
    // public btnStartLanzi: cc.Node = null;
    @property(cc.Node)
    public btnFeiqiu: cc.Node = null;
    @property(cc.Node)
    public btnSuiji: cc.Node = null;
    // public  btnZhenghuo1: cc.Node = null;
    // public  btnZhenghuo2: cc.Node = null;
    // public  btnZhenghuo3: cc.Node = null;

    onLoad() {
        this.btnStart2.on(cc.Node.EventType.MOUSE_UP, this.onClick2, this);
        this.btnStart3.on(cc.Node.EventType.MOUSE_UP, this.onClick3, this);
        this.btnStart13.on(cc.Node.EventType.MOUSE_UP, this.onClick13, this);
        this.btnStart4.on(cc.Node.EventType.MOUSE_UP, this.onClick4, this);
        this.btnOneCommanderA.on(cc.Node.EventType.MOUSE_UP, this.onClickOneA, this);
        //		btnOneCommanderB.addEventListener(MouseEvent.CLICK,onClickOneB);
        this.btnStartHard.on(cc.Node.EventType.MOUSE_UP, this.onClickHard, this);
        this.btnStartHard2.on(cc.Node.EventType.MOUSE_UP, this.onClickHard2, this);
        // this.btnStartLushi.on(cc.Node.EventType.MOUSE_UP, this.onClickLushi, this);
        // this.btnStartLanzi.on(cc.Node.EventType.MOUSE_UP, this.onClickLanzi, this);
        this.btnFeiqiu.on(cc.Node.EventType.MOUSE_UP, this.onClickFeiqiu, this);
        this.btnSuiji.on(cc.Node.EventType.MOUSE_UP, this.onClickSuiji, this);
        // btnZhenghuo1.on(cc.Node.EventType.MOUSE_UP, this.onClickZhenghuo1);
        // btnZhenghuo2.on(cc.Node.EventType.MOUSE_UP, this.onClickZhenghuo2);
        // btnZhenghuo3.on(cc.Node.EventType.MOUSE_UP, this.onClickZhenghuo3);
    }

    public onClick2(evt: Event): void {
        JijieData.modeIsVeryHard = false;
        JijieData.modeIsOnePick = false;
        JijieData.modeIsLanzi = false;
        JijieData.modelFactorCount = 2;
        JijieData.playerName = this.txtName.string;
        JijieControl.toStart();
    }

    public onClick3(evt: Event): void {
        JijieData.modeIsVeryHard = false;
        JijieData.modeIsOnePick = false;
        JijieData.modeIsLanzi = false;
        JijieData.modelFactorCount = 3;
        JijieData.playerName = this.txtName.string;
        JijieControl.toStart();
    }

    public onClick13(evt: Event): void {
        JijieData.modeIsVeryHard = false;
        JijieData.modeIsOnePick = false;
        JijieData.modeIsLanzi = false;
        JijieData.modelFactorCount = 4;
        JijieData.playerName = this.txtName.string;
        JijieControl.toStart();
    }

    public onClick4(evt: Event): void {
        JijieData.modeIsVeryHard = false;
        JijieData.modeIsOnePick = false;
        JijieData.modeIsLanzi = false;
        JijieData.modelFactorCount = 3;
        JijieData.playerName = this.txtName.string;
        JijieData.modeIsZhengjiu = true;
        JijieControl.toStart();
    }

    public onClickHard(evt: Event): void {
        JijieData.modeIsVeryHard = true;
        JijieData.modeIsOnePick = false;
        JijieData.modeIsLanzi = false;
        JijieData.modelFactorCount = 2;
        JijieData.playerName = this.txtName.string;
        JijieControl.toStart();
    }
    public onClickHard2(evt: Event): void {
        JijieData.modeIsVeryHard = true;
        JijieData.modeIsVeryHard2 = true;
        JijieData.modeIsOnePick = false;
        JijieData.modeIsLanzi = false;
        JijieData.modelFactorCount = 2;
        JijieData.playerName = this.txtName.string;
        JijieControl.jjUI.txtMode.string = "极难模式②";
        JijieControl.toStart();
    }

    public onClickLushi(evt: Event): void {
        // LSControl.startLushi();
    }

    public onClickOneA(evt: Event): void {
        JijieData.modelFactorCount = 3;
        JijieData.modeIsVeryHard = false;
        JijieData.modeIsOnePick = true;
        JijieData.modeIsLanzi = false;
        JijieData.playerName = this.txtName.string;
        JijieControl.toStart();

        JijieData.modeIsRandom = false;
        JijieControl.jjUI.txtMode.string = "比赛模式: 单指挥官挑战A";
        JijieControl.toSelect();
    }

    public onClickOneB(evt: Event): void {
        JijieData.modelFactorCount = 4;
        JijieData.modeIsVeryHard = false;
        JijieData.modeIsOnePick = true;
        JijieData.modeIsLanzi = false;
        JijieData.playerName = this.txtName.string;
        JijieControl.toStart();

        JijieData.modeIsRandom = false;
        JijieControl.jjUI.txtMode.string = "比赛模式: 单指挥官挑战B";
        JijieControl.toSelect();
    }

    public onClickLanzi(evt: Event): void {
        JijieData.modelFactorCount = 1;
        JijieData.modeIsVeryHard = false;
        JijieData.modeIsOnePick = false;
        JijieData.modeIsLanzi = true;
        JijieData.playerName = this.txtName.string;
        JijieControl.toStart();

        JijieData.modeIsRandom = false;
        JijieControl.jjUI.txtMode.string = "蓝字模式";
        JijieControl.toSelect();
    }


    public onClickFeiqiu(evt: Event): void {
        JijieData.modelFactorCount = 1;
        JijieData.modeFeiqiu = true;
        JijieData.playerName = this.txtName.string;
        JijieControl.toStart();

        JijieControl.jjUI.txtMode.string = "非酋模式";
        JijieControl.toSelect();
    }

    public onClickSuiji(evt: Event): void {
        JijieData.modelFactorCount = 0;
        JijieData.modeSuiji = true;
        JijieData.playerName = this.txtName.string;
        JijieControl.toStart();

        JijieControl.jjUI.txtMode.string = "随机模式";
        JijieControl.toSelect();
    }

    public onClickZhenghuo1(evt: Event): void {
        JijieData.modeIsVeryHard = false;
        JijieData.modeIsOnePick = false;
        JijieData.modeIsLanzi = false;
        JijieData.modeZhenghuo = true;
        JijieData.modelFactorCount = 2;
        JijieData.playerName = this.txtName.string;
        JijieControl.toStart();

        JijieControl.jjUI.txtMode.string = "整活模式8";
        JijieControl.toSelect();
    }

    public onClickZhenghuo2(evt: Event): void {
        JijieData.modeIsVeryHard = false;
        JijieData.modeIsOnePick = false;
        JijieData.modeIsLanzi = false;
        JijieData.modeZhenghuo = true;
        JijieData.modelFactorCount = 3;
        JijieData.playerName = this.txtName.string;
        JijieControl.toStart();

        JijieControl.jjUI.txtMode.string = "整活模式10";
        JijieControl.toSelect();
    }

    public onClickZhenghuo3(evt: Event): void {
        JijieData.modeIsVeryHard = false;
        JijieData.modeIsOnePick = false;
        JijieData.modeIsLanzi = false;
        JijieData.modeZhenghuo = true;
        JijieData.modelFactorCount = 4;
        JijieData.playerName = this.txtName.string;
        JijieControl.toStart();

        JijieControl.jjUI.txtMode.string = "整活模式12";
        JijieControl.toSelect();
    }
}