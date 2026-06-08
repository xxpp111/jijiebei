import HuiguiData from "../HuiguiData";
import Main from "../Main";
import CommadnerItem from "./view/CommanderItem";
import FactorItem from "./view/FactorItem";
import GuantuFactorItem from "./view/GuantuFactorItem";
import MapItem from "./view/MapItem";
import MatchItem from "./view/MatchItem";

const { ccclass, property } = cc._decorator;

@ccclass
export default class GuantuUI extends cc.Component {

    @property(cc.Node)
    matchContainer: cc.Node = null;

    @property(cc.Node)
    factorContainer: cc.Node = null;
    @property(cc.Node)
    mapContainer: cc.Node = null;
    @property(cc.Node)
    commanderContainer: cc.Node = null;

    @property(cc.Label)
    txtPlayer: cc.Label = null;
    @property(cc.Label)
    txtMessage: cc.Label = null;

    @property(cc.Button)
    btnStart: cc.Button = null;

    dragGuantu: GuantuFactorItem;
    dragFactor: FactorItem;
    dragMap: MapItem;
    dragCommander: CommadnerItem;
    dragPoint: cc.Vec2;

    initUI() {
        var data = HuiguiData;
        this.txtPlayer.string = "当前选手: " + data.playerName;

        //比赛
        for (var i = 0; i < data.matchList.length; i++) {
            var match = data.matchList[i];
            var matchNode = cc.instantiate(data.gameType == "单刷模式" ? Main.instance.matchPrefab1 : Main.instance.matchPrefab2) as cc.Node;
            var matchItem = matchNode.getComponent(MatchItem);
            matchItem.setData(match);

            matchNode.x = 100 + i * 500;
            matchNode.y = 0;
            this.matchContainer.addChild(matchNode);

            //直接放地图
            matchItem.mapItem.loadSprite(data.randomMaps[i].name);
        }

        if (data.gameType == "单刷模式" || data.gameType == "双打模式") {
            for (var i = 0; i < data.randomFactors.length; i++) {
                var fact = data.randomFactors[i];
                var factNode = cc.instantiate(Main.instance.factorPrefab) as cc.Node;
                var factItem = factNode.getComponent(FactorItem);
                factItem.loadSprite(fact);

                factNode.x = i * 75;
                factNode.y = -10;
                this.factorContainer.addChild(factNode);

                factNode.on(cc.Node.EventType.MOUSE_DOWN, this.onFactDown, this);
                factNode.on(cc.Node.EventType.MOUSE_UP, this.onFactUp, this);
                factNode.on(cc.Node.EventType.MOUSE_MOVE, this.onFactMove, this);
            }
        } else {
            //因子
            for (var i = 0; i < data.randomGuantus.length; i++) {
                var factor = data.randomGuantus[i];
                var factorNode = cc.instantiate(Main.instance.guantufactorPrefab) as cc.Node;
                var factorItem = factorNode.getComponent(GuantuFactorItem);
                factorItem.setData(factor);

                factorNode.x = i * 290;
                factorNode.y = 0;
                this.factorContainer.addChild(factorNode);

                factorNode.on(cc.Node.EventType.MOUSE_DOWN, this.onGuantuDown, this);
                factorNode.on(cc.Node.EventType.MOUSE_UP, this.onGuantuUp, this);
                factorNode.on(cc.Node.EventType.MOUSE_MOVE, this.onGuantuMove, this);
            }
        }

        if (data.gameType == "官突模式") {
            //指挥官
            for (var i = 0; i < data.randomCommanders.length; i++) {
                var cmd = data.randomCommanders[i];
                var cmdNode = cc.instantiate(Main.instance.commanderPrefab) as cc.Node;
                var cmdItem = cmdNode.getComponent(CommadnerItem);
                cmdItem.loadSprite(cmd.name, cmd.rankHuigui)

                cmdNode.x = (i % 4) * 80;
                cmdNode.y = 30 - Math.floor(i / 4) * 80;
                this.commanderContainer.addChild(cmdNode);
                cc.log(i, cmd.name);

                cmdNode.on(cc.Node.EventType.MOUSE_DOWN, this.onCmdDown, this);
                cmdNode.on(cc.Node.EventType.MOUSE_UP, this.onCmdUp, this);
                cmdNode.on(cc.Node.EventType.MOUSE_MOVE, this.onCmdMove, this);
            }
        } else {
            //指挥官
            for (var i = 0; i < data.randomCommanders.length; i++) {
                var cmd = data.randomCommanders[i];
                var cmdNode = cc.instantiate(Main.instance.commanderPrefab) as cc.Node;
                var cmdItem = cmdNode.getComponent(CommadnerItem);
                cmdItem.loadSprite(cmd.name)

                cmdNode.x = (i % 10) * 80;
                cmdNode.y = 30 - Math.floor(i / 10) * 80;
                this.commanderContainer.addChild(cmdNode);
                cc.log(i, cmd.name);

                cmdNode.on(cc.Node.EventType.MOUSE_DOWN, this.onCmdDown, this);
                cmdNode.on(cc.Node.EventType.MOUSE_UP, this.onCmdUp, this);
                cmdNode.on(cc.Node.EventType.MOUSE_MOVE, this.onCmdMove, this);
            }
        }


        //地图
        for (var i = 0; i < data.randomMaps.length; i++) {
            var map = data.randomMaps[i];
            var mapNode = cc.instantiate(Main.instance.mapPrefab) as cc.Node;
            var mapItem = mapNode.getComponent(MapItem);
            mapItem.loadSprite(map.name);

            mapNode.x = i * 210;
            mapNode.y = 0;
            this.mapContainer.addChild(mapNode);

            mapNode.on(cc.Node.EventType.MOUSE_DOWN, this.onMapDown, this);
            mapNode.on(cc.Node.EventType.MOUSE_UP, this.onMapUp, this);
            mapNode.on(cc.Node.EventType.MOUSE_MOVE, this.onMapMove, this);
        }
    }

    onGuantuDown(evt: cc.Event.EventMouse) {
        this.dragGuantu = evt.target.getComponent(GuantuFactorItem);
        this.dragPoint = cc.v2(evt.getLocationX() - this.dragGuantu.node.x, evt.getLocationY() - this.dragGuantu.node.y);
        this.dragGuantu.startPoint = cc.v2(this.dragGuantu.node.x, this.dragGuantu.node.y);
    }

    onGuantuMove(evt: cc.Event.EventMouse) {
        if (this.dragGuantu) {
            this.dragGuantu.node.x = evt.getLocationX() - this.dragPoint.x;
            this.dragGuantu.node.y = evt.getLocationY() - this.dragPoint.y;
        }
    }

    onGuantuUp(evt: cc.Event.EventMouse) {
        //是否碰撞match
        for (var node of this.matchContainer.children) {
            var loc = this.checkEvtToNode(evt, node);
            if (loc) {
                var item = node.getComponent(MatchItem);
                if (loc.y > -200) {
                    item.dragGuantu(this.dragGuantu);
                } else {
                    item.dragGuantu2(this.dragGuantu);
                }

                break;
            }
        }

        this.dragGuantu = null;
        this.dragPoint = null;
    }

    onFactDown(evt: cc.Event.EventMouse) {
        this.dragFactor = evt.target.getComponent(FactorItem);
        this.dragPoint = cc.v2(evt.getLocationX() - this.dragFactor.node.x, evt.getLocationY() - this.dragFactor.node.y);
        this.dragFactor.startPoint = cc.v2(this.dragFactor.node.x, this.dragFactor.node.y);
    }

    onFactMove(evt: cc.Event.EventMouse) {
        if (this.dragFactor) {
            this.dragFactor.node.x = evt.getLocationX() - this.dragPoint.x;
            this.dragFactor.node.y = evt.getLocationY() - this.dragPoint.y;
        }
    }

    onFactUp(evt: cc.Event.EventMouse) {
        //是否碰撞match
        for (var node of this.matchContainer.children) {
            var matchItem = node.getComponent(MatchItem);
            for (var i = 1; i <= 2; i++) {
                var arr = matchItem["item" + i];
                for (var j = 0; j < arr.length; j++) {
                    var item = arr[j] as FactorItem;
                    var loc = this.checkEvtToNode(evt, item.node);
                    if (loc) {
                        if (item.selectedFactor) {
                            item.selectedFactor.node.active = true;
                            item.selectedFactor.node.x = item.selectedFactor.startPoint.x;
                            item.selectedFactor.node.y = item.selectedFactor.startPoint.y;
                        }

                        item.loadSprite(this.dragFactor.picName);
                        item.selectedFactor = this.dragFactor;
                        this.dragFactor.node.active = false;
                    }
                }
            }

        }

        this.dragFactor = null;
        this.dragPoint = null;
    }

    onCmdDown(evt: cc.Event.EventMouse) {
        this.dragCommander = evt.target.getComponent(CommadnerItem);
        this.dragPoint = cc.v2(evt.getLocationX() - this.dragCommander.node.x, evt.getLocationY() - this.dragCommander.node.y);
        this.dragCommander.startPoint = cc.v2(this.dragCommander.node.x, this.dragCommander.node.y);
    }

    onCmdMove(evt: cc.Event.EventMouse) {
        if (this.dragCommander) {
            this.dragCommander.node.x = evt.getLocationX() - this.dragPoint.x;
            this.dragCommander.node.y = evt.getLocationY() - this.dragPoint.y;
        }
    }

    onCmdUp(evt: cc.Event.EventMouse) {
        //是否碰撞cmd
        for (var node of this.matchContainer.children) {
            var matchItem = node.getComponent(MatchItem);
            if (this.checkEvtToNode(evt, matchItem.cmd1.node)) {
                matchItem.cmd1.drag(this.dragCommander);
                break;
            }
            if (matchItem.cmd2 && matchItem.cmd2.node.active && this.checkEvtToNode(evt, matchItem.cmd2.node)) {
                matchItem.cmd2.drag(this.dragCommander);
                break;
            }
        }

        this.dragCommander = null;
        this.dragPoint = null;
    }

    onMapDown(evt: cc.Event.EventMouse) {
        this.dragMap = evt.target.getComponent(MapItem);
        this.dragPoint = cc.v2(evt.getLocationX() - this.dragMap.node.x, evt.getLocationY() - this.dragMap.node.y);
        this.dragMap.startPoint = cc.v2(this.dragMap.node.x, this.dragMap.node.y);
    }

    onMapMove(evt: cc.Event.EventMouse) {
        if (this.dragMap) {
            this.dragMap.node.x = evt.getLocationX() - this.dragPoint.x;
            this.dragMap.node.y = evt.getLocationY() - this.dragPoint.y;
        }
    }

    onMapUp(evt: cc.Event.EventMouse) {
        //是否碰撞match
        for (var node of this.matchContainer.children) {
            var matchItem = node.getComponent(MatchItem);
            if (this.checkEvtToNode(evt, matchItem.mapItem.node)) {
                matchItem.mapItem.drag(this.dragMap);
                break;
            }
        }

        this.dragMap = null;
        this.dragPoint = null;
    }

    checkEvtToNode(evt: cc.Event.EventMouse, node: cc.Node): cc.Vec2 {
        var loc = evt.getLocation();
        loc = node.convertToNodeSpaceAR(loc);
        if (loc.x > 0 && loc.x < node.width && loc.y < 0 && loc.y > -node.height) {
            return loc;
        }
    }

    rankArr = ["S", "A", "B", "C", "O"];

    onStartClick() {
        //检查
        if (HuiguiData.gameType == "单刷模式") {
            var r1 = this.matchContainer.children[0].getComponent(MatchItem).cmd1.rank;
            var r2 = this.matchContainer.children[1].getComponent(MatchItem).cmd1.rank;
            if (!r1) {
                this.showError(`第1场比赛未选择指挥官`);
                return;
            }
            if (!r2) {
                this.showError(`第2场比赛未选择指挥官`);
                return;
            }
            if (this.rankArr.indexOf(r1) + this.rankArr.indexOf(r2) < 4) {
                this.showError(`两场比赛指挥官等级为${r1}${r2}`);
                return;
            }
        } else {
            for (var i = 0; i < this.matchContainer.children.length; i++) {
                var node = this.matchContainer.children[i];
                var item = node.getComponent(MatchItem);
                var r1 = item.cmd1.rank;
                var r2 = item.cmd2.rank;
                if (!item.cmd1.picName || !item.cmd2.picName) {
                    this.showError(`第${i + 1}场比赛未选择指挥官`);
                    return;
                }
                if (r1 && r2 && this.rankArr.indexOf(r1) + this.rankArr.indexOf(r2) < 4) {
                    this.showError(`第${i + 1}场比赛指挥官等级为${r1}${r2}`);
                    return;
                }
            }
        }


        //切换
        var list: MatchItem[] = [];
        for (var node of this.matchContainer.children) {
            var matchItem = node.getComponent(MatchItem);
            matchItem.toGame();
            list.push(matchItem);
        }
        //换界面
        this.node.parent = null;
        Main.instance.toResult(list);
    }

    showError(msg: string) {
        this.txtMessage.string = msg;
        this.txtMessage.node.active = true;
    }
}