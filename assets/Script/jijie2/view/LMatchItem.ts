import JJLog from "../JJLog";
import JijieControl from "../JijieContro";
import JijieData from "../JijieData";
import ConfigData from "../data/JJConfigData";
import LCommanderItem from "./LCommanderItem";
import LFactorItem from "./LFactorItem";
import LMapItem from "./LMapItem";


const { ccclass, property } = cc._decorator;

@ccclass
export default class LMatchItem extends cc.Component {
    @property(cc.Label)
    public txtTitle: cc.Label = null;
    @property(LMapItem)
    public spMap: LMapItem = null;
    @property(LCommanderItem)
    public spCommander: LCommanderItem = null;
    // @property(LCommanderItem)
    // public spCommander2: LCommanderItem = null;

    @property(LFactorItem)
    public lockFactor: LFactorItem = null;
    @property(LFactorItem)
    public factor1: LFactorItem = null;
    @property(LFactorItem)
    public factor2: LFactorItem = null;
    @property(LFactorItem)
    public factor3: LFactorItem = null;
    @property(LFactorItem)
    public factor4: LFactorItem = null;

    @property(cc.Label)
    public txtResult: cc.Label = null;
    @property(cc.Node)
    public btnWin: cc.Node = null;
    @property(cc.Node)
    public btnWinb: cc.Node = null;
    @property(cc.Node)
    public btnLose: cc.Node = null;

    public id: number;

    // @property(cc.Node)
    // public btnAI: cc.Node = null;
    // @property(cc.Label)
    // public txtAI: cc.Label = null;

    protected onLoad() {
        this.spCommander.updateSelect(true);
        // this.spCommander2.updateSelect(true);
        // this.btnAI.active = false;
        // this.txtAI.node.active = false;
        // btnAI.mouseChildren = false;
        // this.spCommander2.node.active = false;
        // this.btnAI.on(cc.Node.EventType.MOUSE_UP, this.onAIClick, this);
    }

    public initZero(id: number): void {
        this.id = id;
        if (id != 3) {
            this.txtTitle.string = "第" + id + "场 ";
        } else {
            this.txtTitle.string = "BOSS战 ";
        }


        this.txtResult.string = "";
        // this.txtResult.mouseEnabled = false;
        this.btnWin.active = false;
        this.btnWinb.active = false;
        this.btnLose.active = false;
        // this.btnWin.mouseChildren = false;
        // this.btnWinb.mouseChildren = false;
        // this.btnLose.mouseChildren = false;
        // this.spCommander2.node.active = false;
    }

    public updateStart(): void {
        var index = this.id - 1;
        this.txtTitle.string += JijieData.mapList[index];
        this.spMap.loadMap(JijieData.mapList[index]);
        this.lockFactor.loadFactor(JijieData.lockFactorList[index]);
        this.lockFactor.updateSelectLock();

        if (JijieData.modeFeiqiu) {
            // this.spCommander2.node.active = true;
        }

        var fcount = JijieData.modelFactorCount;
        if (this.id == 3) {
            fcount++;
            if (JijieData.modeIsVeryHard) {
                fcount = 4;
            }
            if (JijieData.modeIsOnePick && JijieData.modelFactorCount == 3) {
                fcount = 3;
            }
        } else if (this.id == 2) {
            if (JijieData.modelFactorCount == 2)
                fcount++;
            if (JijieData.modeIsVeryHard) {
                fcount = 3;
            }
        } else {
            if (JijieData.modeIsVeryHard) {
                fcount = 3;
            }
        }


        if (JijieData.modeFeiqiu) {
            this.factor2.node.active = false;
            this.factor3.node.active = false;
        } else if (JijieData.modeSuiji) {
            this.factor1.node.active = false;
            this.factor2.node.active = false;
            this.factor3.node.active = false;
            this.lockFactor.node.active = false;
        } else {
            //factor4.visible = false;
            if (fcount == 2) {
                this.factor2.node.active = false;
                this.factor3.node.active = false;
            } else if (fcount == 3) {
                this.factor3.node.active = false;
            } else if (fcount == 5) {
                this.factor2.node.active = true;
                this.factor3.node.active = true;
                //factor4.visible = true;
            } else {
                this.factor2.node.active = true;
                this.factor3.node.active = true;
            }
        }



        if (JijieData.modeIsLanzi) {
            this.lockFactor.node.active = false;
            this.factor2.node.active = false;
            this.factor3.node.active = false;
        }
    }

    public toBattle(): void {

        if (this.spCommander.cname == "自选") {
            if (JijieControl.jjUI.panelSelect.selectedItem) {
                this.spCommander.cname = JijieControl.jjUI.panelSelect.selectedItem.cname;
            }
        }
        this.spCommander.setCName(this.spCommander.cname);
        // this.spCommander2.setCName(this.spCommander2.cname);

        if (this.factor1.node.active) {
            this.factor1.loadFactor(this.factor1.factorName);
        }
        if (this.factor2.node.active) {
            this.factor2.loadFactor(this.factor2.factorName);
        }
        if (this.factor3.node.active ){//&& !this.factor3.banSp.active) {
            this.factor3.loadFactor(this.factor3.factorName);
        }

        this.btnWin.active = true;
        this.btnWinb.active = true;
        this.btnLose.active = true;

        this.btnWin.on(cc.Node.EventType.MOUSE_UP, this.onWinClick, this);
        this.btnWinb.on(cc.Node.EventType.MOUSE_UP, this.onWinbClick, this);
        this.btnLose.on(cc.Node.EventType.MOUSE_UP, this.onLoseClick, this);

        // this.btnAI.active = true;
    }

    private onWinClick(evt: Event): void {
        JijieData.winCount++;
        JijieData.totalCount++;


        this.txtResult.string = "胜利";

        var logArr:string[] = [new Date().toString(), this.spCommander.cname, this.txtResult.string, this.spMap.factorName, this.lockFactor.factorName];
        if (this.factor1.node.active) logArr.push(this.factor1.factorName);
        if (this.factor2.node.active) logArr.push(this.factor2.factorName);
        if (this.factor3.node.active) logArr.push(this.factor3.factorName);
        JJLog.writeMatchLog(logArr);

        this.reset();
        if (JijieData.totalCount >= 3) {
            JijieControl.showResultEnd();
        }
    }

    private onWinbClick(evt: Event): void {
        JijieData.winCount++;
        JijieData.winbCount++;
        JijieData.totalCount++;


        this.txtResult.string = "带奖励获胜";

        var logArr: string[] = [new Date().toString(), this.spCommander.cname, this.txtResult.string, this.spMap.factorName, this.lockFactor.factorName];
        if (this.factor1.node.active) logArr.push(this.factor1.factorName);
        if (this.factor2.node.active) logArr.push(this.factor2.factorName);
        if (this.factor3.node.active) logArr.push(this.factor3.factorName);
        JJLog.writeMatchLog(logArr);

        this.reset();
        if (JijieData.totalCount >= 3) {
            JijieControl.showResultEnd();
        }
    }

    private onLoseClick(evt: Event): void {
        JijieData.totalCount++;


        this.txtResult.string = "失败";

        var logArr: string[] = [new Date().toString(), this.spCommander.cname, this.txtResult.string, this.spMap.factorName, this.lockFactor.factorName];
        if (this.factor1.node.active) logArr.push(this.factor1.factorName);
        if (this.factor2.node.active) logArr.push(this.factor2.factorName);
        if (this.factor3.node.active) logArr.push(this.factor3.factorName);
        JJLog.writeMatchLog(logArr);

        if (JijieData.modeIsRandom) {
            this.reset();
            if (JijieData.totalCount >= 3) {
                JijieControl.showResultEnd();
            }
        } else {
            this.reset();

            JijieControl.showResultLose();
        }

    }

    public reset(): void {
        this.btnWin.active = false;
        this.btnWinb.active = false;
        this.btnLose.active = false;
        // this.btnAI.active = false;
        // this.txtAI.node.active = false;
        this.lockFactor.node.active = true;
    }

    public checkBCount(): void {
        var name: string = this.spCommander.cname;
        if (this.spCommander.cname == "自选") {
            if (JijieData.modelFactorCount == 2 && !JijieData.modeIsVeryHard) {
                JijieData.pickBCount++;
                return;
            }

            if (JijieControl.jjUI.panelSelect.selectedItem) {
                name = JijieControl.jjUI.panelSelect.selectedItem.cname;
            }
        }

        for (var i = 0; i < ConfigData.commanderList.length; i++) {
            if (name == ConfigData.commanderList[i][0]) {
                if (ConfigData.commanderList[i][1] == "B") {
                    JijieData.pickBCount++;
                }
                if (ConfigData.commanderList[i][1] == "A") {
                    JijieData.pickACount++;
                }
            }
        }
    }

    public onAIClick(evt) {
        var ai = ["步战机甲", "大师机械", "袭扰炮击", "卡莱的希望", "风暴迫临", "族长之军", "艾尔先锋",
            "战争机械团", "突击团", "暗影科技团", "帝国战斗群", "旧世机械团",
            "爆炸威胁", "感染肆虐", "滋生腐化", "侵略虫群"];
        var ra = Math.floor((Math.random() * ai.length));
        // this.txtAI.node.active = true;
        // this.btnAI.active = false;
        // this.txtAI.string = ai[ra];
    }
}