import MatchItem from "./LMatchItem";
import JijieControl from "../JijieContro";
import JijieData from "../JijieData";
import ConfigData from "../data/JJConfigData";
import CommanderItem from "./LCommanderItem";
import LFactorItem from "./LFactorItem";
import URLSprite from "./URLSprite";
import JijieMain from "../JijieMain";

const { ccclass, property } = cc._decorator;

@ccclass
export default class SelectPanel extends cc.Component {
    @property(cc.Node)
    public randomFactorContainer: cc.Node = null;
    @property(cc.Node)
    public commanderAContainer: cc.Node = null;
    @property(cc.Node)
    public commanderBContainer: cc.Node = null;
    @property(cc.Node)
    public commanderCContainer: cc.Node = null;
    @property(cc.Node)
    public commanderPickContainer: cc.Node = null;
    @property(cc.Node)
    public btnStart: cc.Node = null;

    public pressedObject: URLSprite = null;
    public pressedType: number;
    public pressX: number;
    public pressY: number;

    @property(cc.Label)
    public txtError: cc.Label = null;

    public selectedItem: CommanderItem;

    @property(cc.Node)
    public btnRandomCommander: cc.Node = null;

    onLoad() {
        // btnStart.mouseChildren = false;
        this.txtError.string = "";
        this.btnRandomCommander.active = false;
        // btnRandomCommander.mouseChildren = false;
        this.btnRandomCommander.on(cc.Node.EventType.MOUSE_UP, this.onRandomClick, this);
    }

    public updateSelect(): void {
        var usp: URLSprite = null;
        //刷新因子
        this.randomFactorContainer.removeAllChildren();
        for (var i = 0; i < JijieData.randomFactorPoor.length; i++) {
            usp = new URLSprite("images/factor/" + JijieData.randomFactorPoor[i] + ".png", 100 / 1.45, 100 / 1.45, 10 + i * 105, 10, i);
            this.randomFactorContainer.addChild(usp);
            usp.on(cc.Node.EventType.MOUSE_DOWN, this.onFactorDown, this);
            usp.on(cc.Node.EventType.MOUSE_UP, this.onFactorUP, this);
        }

        //刷新指挥官
        this.commanderAContainer.removeAllChildren();
        for (var i = 0; i < JijieData.randomCommanderPoorA.length; i++) {
            var x = (i % 6) * 100;
            var y = i >= 6 ? 85 : 0;
            usp = new URLSprite("images/commander/" + JijieData.randomCommanderPoorA[i] + ".png", 70, 75, x, y, i);
            this.commanderAContainer.addChild(usp);
            usp.on(cc.Node.EventType.MOUSE_DOWN, this.onCommanderDown, this);
            usp.on(cc.Node.EventType.MOUSE_UP, this.onCommanderUP, this);
        }
        this.commanderBContainer.removeAllChildren();
        for (var i = 0; i < JijieData.randomCommanderPoorB.length; i++) {
            var x = (i % 3) * 100;
            var y = i >= 3 ? 85 : 0;
            usp = new URLSprite("images/commander/" + JijieData.randomCommanderPoorB[i] + ".png", 70, 75, x, y, 100 + i);
            this.commanderBContainer.addChild(usp);
            usp.on(cc.Node.EventType.MOUSE_DOWN, this.onCommanderDown, this);
            usp.on(cc.Node.EventType.MOUSE_UP, this.onCommanderUP, this);
        }
        //			commanderCContainer.removeChildren();
        //			for(var i:int = 0;i<JijieData.randomCommanderPoorC.length;i++){
        //				var x:int = (i%5)*100;
        //				var y:int = i>=5 ? 85 : 0;
        //				usp = new URLcc.Node = null("images/commander/"+JijieData.randomCommanderPoorC[i]+".png",70,75,x,y,200+i);
        //				commanderCContainer.addChild(usp);
        //			}
        this.commanderPickContainer.removeAllChildren();
        if (!JijieData.modeIsZhengjiu && !JijieData.modeSuiji && (!JijieData.modeIsVeryHard || JijieData.modeIsVeryHard2) && !JijieData.modeFeiqiu) {
            //刷新全体自选指挥官框
            var x = 0;
            for (var i = 0; i < ConfigData.commanderList.length; i++) {

                var cname: string = ConfigData.commanderList[i][0];
                if (JijieData.randomCommanderPoorA.indexOf(cname) >= 0) {
                    continue;
                }
                if (JijieData.randomCommanderPoorB.indexOf(cname) >= 0) {
                    continue;
                }
                if (JijieData.randomCommanderPoorC.indexOf(cname) >= 0) {
                    continue;
                }
                if (JijieData.modeIsOnePick) {
                    if (JijieData.modelFactorCount == 3) {
                        //排除a组
                        if (ConfigData.commanderList[i][1] == "B") {
                            continue;
                        }
                    } else {
                        //排除bc组
                        if (ConfigData.commanderList[i][1] == "A" || ConfigData.commanderList[i][1] == "C") {
                            continue;
                        }
                    }
                }

                var cnode = cc.instantiate(JijieMain.instance.commanderPrefab) as cc.Node;
                var item: CommanderItem = cnode.getComponent(CommanderItem);
                item.init(cname);
                item.node.x = x;
                x += 55;
                item.node.scaleX = item.node.scaleY = 1.5;
                this.commanderPickContainer.addChild(item.node);
            }
        }



        //监听因子滑动 提前汇总因子槽

        this.node.parent.on(cc.Node.EventType.MOUSE_MOVE, this.onMove, this);
        //监听指挥官滑动 提前汇总指挥官槽

        // this.commanderBContainer.on(cc.Node.EventType.MOUSE_DOWN, this.onCommanderDown, this);
        // this.commanderBContainer.on(cc.Node.EventType.MOUSE_UP, this.onCommanderUP, this);
        // this.commanderCContainer.on(cc.Node.EventType.MOUSE_DOWN, this.onCommanderDown, this);
        // this.commanderCContainer.on(cc.Node.EventType.MOUSE_UP, this.onCommanderUP, this);
        //监听开始
        this.btnStart.on(cc.Node.EventType.MOUSE_UP, this.onStartClick, this);

        this.commanderPickContainer.on(cc.Node.EventType.MOUSE_UP, this.onPickClick, this);


        this.btnRandomCommander.active = JijieData.modeFeiqiu;
    }

    private onFactorDown(evt: cc.Event.EventMouse): void {
        this.pressedObject = evt.target as URLSprite;
        if (!this.pressedObject.twidth) {
            this.pressedObject = null;
            return;
        }
        this.pressX = this.pressedObject.x - evt.getLocationX() / JijieControl.jjUI.node.scaleX;
        this.pressY = this.pressedObject.y - evt.getLocationY() / JijieControl.jjUI.node.scaleX;
        this.pressedType = 0;
    }

    private onMove(evt: cc.Event.EventMouse): void {
        if (this.pressedObject) {
            this.pressedObject.x = evt.getLocationX() / JijieControl.jjUI.node.scaleX + this.pressX;
            this.pressedObject.y = evt.getLocationY() / JijieControl.jjUI.node.scaleX + this.pressY;
        }
    }

    private onFactorUP(evt: cc.Event.EventMouse): void {

        if (this.pressedObject) {
            //碰撞检测
            for (var imap = 1; imap <= 3; imap++) {
                var match: MatchItem = JijieControl.jjUI["map" + imap];
                for (var ifct = 1; ifct <= 3; ifct++) {
                    var fct: LFactorItem = match["factor" + ifct];
                    if (fct.node.active) {
                        var result = SelectPanel.checkHit(this.pressedObject, fct.node);
                        if (result) {
                            fct.factorName = JijieData.randomFactorPoor[this.pressedObject.id];
                            cc.log("碰撞成功 " + imap + " " + ifct);
                            this.pressedObject = null;
                            return;
                        }
                    }
                }
            }

            this.pressedObject = null;
        }

    }

    private onCommanderDown(evt: cc.Event.EventMouse): void {
        this.pressedObject = evt.target as URLSprite;
        cc.log(this.pressedObject.name);
        if (!this.pressedObject.twidth) {
            this.pressedObject = null;
            return;
        }
        this.pressX = this.pressedObject.x - evt.getLocationX() / JijieControl.jjUI.node.scaleX;
        this.pressY = this.pressedObject.y - evt.getLocationY() / JijieControl.jjUI.node.scaleX;
        this.pressedType = 1;
    }

    private onCommanderUP(evt: cc.Event.EventMouse): void {
        if (this.pressedObject) {
            //碰撞检测
            for (var imap = 1; imap <= 3; imap++) {
                var match: MatchItem = JijieControl.jjUI["map" + imap];
                var result: Boolean = SelectPanel.checkHit(this.pressedObject, match.spCommander.node);
                if (result) {
                    if (this.pressedObject.id >= 200) {
                        match.spCommander.cname = JijieData.randomCommanderPoorC[this.pressedObject.id - 200];
                    } else if (this.pressedObject.id >= 100) {
                        match.spCommander.cname = JijieData.randomCommanderPoorB[this.pressedObject.id - 100];
                    } else {
                        match.spCommander.cname = JijieData.randomCommanderPoorA[this.pressedObject.id];
                    }
                    cc.log("碰撞成功 " + imap + " ");
                    JijieControl.updateBCount();
                    break;
                } else {
                    // var result: Boolean = SelectPanel.checkHit(this.pressedObject, match.spCommander2.node);
                    // if (result && match.spCommander2.node.active) {
                    //     if (this.pressedObject.id >= 100) {
                    //         match.spCommander2.cname = JijieData.randomCommanderPoorB[this.pressedObject.id - 100];
                    //     } else {
                    //         match.spCommander2.cname = JijieData.randomCommanderPoorA[this.pressedObject.id];
                    //     }
                    //     cc.log("碰撞成功 " + imap + " ");
                    //     JijieControl.updateBCount();
                    //     break;
                    // }
                }

            }

            this.pressedObject = null;
        }
    }

    private onStartClick(evt: cc.Event.EventMouse): void {
        var flag = true;
        //检测
        for (var imap = 1; imap <= 3; imap++) {
            var match: MatchItem = JijieControl.jjUI["map" + imap];
            if (match.spCommander.cname == null) {
                flag = false;
                this.txtError.string = "第" + imap + "场指挥官未选择";
                break;
            }
            // if (match.spCommander2.node.active && match.spCommander2.cname == null) {
            //     flag = false;
            //     this.txtError.string = "第" + imap + "场指挥官2未选择";
            //     break;
            // }
            for (var ifct = 1; ifct <= 3; ifct++) {
                var fct: LFactorItem = match["factor" + ifct];
                if (fct.node.active) {// && !fct.banSp.active) {
                    if (fct.factorName == null) {
                        flag = false;
                        this.txtError.string = "第" + imap + "场因子" + ifct + "未选择";
                        break;
                    }
                }
            }
        }

        //检测b组 是否单一  手选是否用了手选 是否用了b组 手选是否选定 手选选定的是否b组
        if (!JijieData.modeIsOnePick && JijieData.modelFactorCount > 2) {
            JijieData.pickBCount = 0;
            JijieData.pickACount = 0;
            JijieControl.jjUI.map1.checkBCount();
            JijieControl.jjUI.map2.checkBCount();
            JijieControl.jjUI.map3.checkBCount();
            if (JijieData.pickBCount > 1) {
                flag = false;
                this.txtError.string = "B组指挥官只能选1个";
            }
            //				if(JijieData.pickACount > 1){
            //					flag = false;
            //					txtError.text = "A组指挥官只能选1个";
            //				}
        }


        if (flag) {
            //切状态
            this.txtError.string = "";
            JijieControl.toBattle();
        } else {
            cc.log("有未选择的英雄和因子");
        }

    }

    static checkHit(o1: cc.Node = null, o2: cc.Node = null): Boolean {
        var p1: cc.Vec2 = cc.v2(0, 0);
        p1 = o1.convertToWorldSpaceAR(p1);

        var p2: cc.Vec2 = cc.v2(0, 0);
        p2 = o2.convertToWorldSpaceAR(p2);

        if (Math.abs(p1.x - p2.x) < 30 && Math.abs(p1.y - p2.y) < 30) {
            return true;
        }


        return false;
    }


    private onPickClick(evt: cc.Event.EventMouse): void {
        var item: CommanderItem = evt.target as CommanderItem;
        if (item == this.selectedItem) {
            this.selectedItem.updateSelect(false);
            this.selectedItem = null;
        } else {
            if (this.selectedItem) {
                this.selectedItem.updateSelect(false);
            }
            this.selectedItem = item;
            this.selectedItem.updateSelect(true);

            JijieControl.updateBCount();
        }
    }

    private onRandomClick(evt: cc.Event.EventMouse): void {
        var commanderList: string[] = [];
        for (var i = 0; i < JijieData.randomCommanderPoorC.length; i++) {
            if (JijieData.randomCommanderPoorC[i] == "自选") {
                continue;
            }
            commanderList.push(JijieData.randomCommanderPoorC[i]);
        }
        for (var i = 0; i < JijieData.randomCommanderPoorB.length; i++) {
            commanderList.push(JijieData.randomCommanderPoorB[i]);
        }
        for (var i = 0; i < JijieData.randomCommanderPoorA.length; i++) {
            commanderList.push(JijieData.randomCommanderPoorA[i]);
        }

        for (var i = 0; i < 6; i++) {
            //确定位置
            var matchId = Math.floor(i / 2) + 1;
            var match: MatchItem = JijieControl.jjUI["map" + matchId];
            var ccc: CommanderItem;
            if (i % 2 == 0) {
                ccc = match.spCommander;
            } else {
                //ccc = match.spCommander2;
            }
            //抽取
            var ra = Math.floor(Math.random() * commanderList.length);
            var commander = commanderList[ra];
            commanderList.splice(ra, 1);

            //找到目标
            var item: URLSprite;
            var index = JijieData.randomCommanderPoorA.indexOf(commander);
            if (index >= 0) {
                item = this.commanderAContainer.children[index] as URLSprite;
            } else {
                index = JijieData.randomCommanderPoorB.indexOf(commander);
                if (index >= 0) {
                    item = this.commanderBContainer.children[index] as URLSprite;
                } else {
                    index = JijieData.randomCommanderPoorC.indexOf(commander);
                    item = this.commanderCContainer.children[index] as URLSprite;
                }
            }

            //移动
            var p = cc.v2(0, 0);
            p = ccc.node.convertToWorldSpaceAR(p);
            p = item.parent.convertToNodeSpaceAR(p);
            item.x = p.x;
            item.y = p.y;

            //设定
            ccc.cname = commander;
        }
    }
}