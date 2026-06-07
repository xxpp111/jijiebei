import JijieControl from "./JijieContro";
import JijieData from "./JijieData";
import JijieMain from "./JijieMain";
import ConfigData from "./data/JJConfigData";
import InitPanel from "./view/InitPanel";
import LFactorItem from "./view/LFactorItem";
import MatchItem from "./view/LMatchItem";
import SelectPanel from "./view/SelectPanel";

const { ccclass, property } = cc._decorator;

@ccclass
export default class JJUI extends cc.Component {
    @property(cc.Label)
    public txtTitle: cc.Label = null;
    @property(cc.Label)
    public txtPlayerName: cc.Label = null;
    @property(cc.Label)
    public txtMode: cc.Label = null;

    @property(MatchItem)
    public map1: MatchItem = null;
    @property(MatchItem)
    public map2: MatchItem = null;
    @property(MatchItem)
    public map3: MatchItem = null;

    @property(SelectPanel)
    public panelSelect: SelectPanel = null;

    // @property(cc.Node)
    // public btnRestart: cc.Node = null;
    @property(cc.Label)
    public txtResult: cc.Label = null;

    @property(cc.Node)
    public btnSelect: cc.Node = null;
    @property(cc.Node)
    public btnRandom: cc.Node = null;

    @property(InitPanel)
    public initPanel: InitPanel = null;

    protected onLoad(): void {
        // var scale: number = JijieMain.istage.getContentSize().height / 720;
        // scale = 0.48;
        // this.node.scaleX = this.node.scaleY = scale;
        // this.node.x = ((JijieMain.istage.getContentSize().width / scale) - 1280) / 2 * scale;
        // cc.log(this.node.x);
        // this.node.x = -57;
    }

    public initZero(): void {
        this.txtMode.string = "";
        this.txtPlayerName.string = "";

        this.map1.initZero(1);
        this.map2.initZero(2);
        this.map3.initZero(3);

        this.panelSelect.node.active = false;

        //btnRestart.visible = false;
        this.txtResult.string = "";
        // this.txtResult.mouseEnabled = false;
        this.initPanel.node.active = true;
    }

    public updateToStart(): void {
        this.initPanel.node.active = false;

        //更新地图因子
        this.map1.updateStart();
        this.map2.updateStart();
        this.map3.updateStart();

        //监听选择
        this.btnSelect.on(cc.Node.EventType.MOUSE_UP, this.onSelectClick, this);
        this.btnRandom.on(cc.Node.EventType.MOUSE_UP, this.onRandomClick, this);
    }

    public onSelectClick(evt: MouseEvent): void {
        JijieData.modeIsRandom = false;
        var fcount = JijieData.modelFactorCount == 2 ? 8 : 10;
        if (JijieData.modelFactorCount == 4) {
            fcount = 12;
        }
        this.txtMode.string = "比赛模式: " + fcount + "因子 - 手选";
        JijieControl.toSelect();
    }

    public onRandomClick(evt: MouseEvent): void {
        JijieData.modeIsRandom = true;
        var fcount = JijieData.modelFactorCount == 2 ? 8 : 10;
        if (JijieData.modelFactorCount == 4) {
            fcount = 12;
        }
        this.txtMode.string = "比赛模式: " + fcount + "因子 - 随机";

        //切入选择
        this.btnSelect.active = false;
        this.btnRandom.active = false;
        this.panelSelect.node.active = true;
        this.panelSelect.updateSelect();

        //随机因子和指挥官
        var factorCount = 0;
        if (JijieData.modelFactorCount == 2) {
            factorCount = ConfigData.paramMap["随机因子数7"];
        } else if (JijieData.modelFactorCount == 4) {
            factorCount = ConfigData.paramMap["随机因子数13"];
        } else {
            factorCount = ConfigData.paramMap["随机因子数10"];
        }
        for (var i = 0; i < factorCount; i++) {
            var factor: string = ConfigData.getJijieFactor(false);
            ConfigData.popFactor(factor);
            JijieData.randomFactorPoor.push(factor);
        }
        var groupList = ConfigData.commanderList;
        for (var i = 0; i < 3; i++) {
            var raIndex = Math.floor(Math.random() * groupList.length);
            var commander: string = groupList[raIndex][0];
            JijieData.randomCommanderPoorA.push(commander);
            groupList.splice(raIndex, 1);
        }
        //填充
        for (var imap = 1; imap <= 3; imap++) {
            var match: MatchItem = JijieControl.jjUI["map" + imap];
            match.spCommander.cname = JijieData.randomCommanderPoorA.pop();
            for (var ifct = 1; ifct <= 3; ifct++) {
                var fct: LFactorItem = match["factor" + ifct];
                if (fct.node.active) {
                    fct.factorName = JijieData.randomFactorPoor.pop();
                }
            }
        }

        //下一步
        JijieControl.toBattle();
    }

    public updateToSelect(): void {
        this.btnSelect.active = false;
        this.btnRandom.active = false;

        //显示
        this.panelSelect.node.active = true;
        this.panelSelect.updateSelect();
    }

    public toBattle(): void {
        this.panelSelect.node.active = false;
        // this.btnRestart.active = true;

        this.map1.toBattle();
        this.map2.toBattle();
        this.map3.toBattle();

        this.map2.node.y = this.map1.node.y - 140;
        this.map3.node.y = this.map1.node.y - 280;
    }
}