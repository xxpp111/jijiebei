import ConfigData from "../../ConfigData";
import HuiguiData from "../../HuiguiData";
import MatchData from "../../data/MatchData";
import CommadnerItem from "./CommanderItem";
import FactorItem from "./FactorItem";
import GuantuFactorItem from "./GuantuFactorItem";
import MapItem from "./MapItem";

const { ccclass, property } = cc._decorator;

@ccclass
export default class MatchItem extends cc.Component {

    @property(cc.Label)
    title: cc.Label = null;

    @property(MapItem)
    mapItem: MapItem = null;

    @property(CommadnerItem)
    cmd1: CommadnerItem = null;
    @property(CommadnerItem)
    cmd2: CommadnerItem = null;

    @property([FactorItem])
    item1: FactorItem[] = [null, null, null]
    @property([FactorItem])
    item2: FactorItem[] = [null, null, null]

    @property(cc.Label)
    result: cc.Label = null;

    @property(cc.Button)
    btnWin1: cc.Button = null;
    @property(cc.Button)
    btnWin2: cc.Button = null;
    @property(cc.Button)
    btnLose: cc.Button = null;

    data: MatchData;

    selecteddGuanty:GuantuFactorItem;
    selecteddGuanty2:GuantuFactorItem;

    protected onLoad(): void {
        this.addEvents(true);
    }

    addEvents(flag:boolean){
        if (HuiguiData.gameType == "单刷模式" || HuiguiData.gameType == "双打模式") {
            for(var item of this.item1){
                if(flag){
                    item.node.on(cc.Node.EventType.MOUSE_DOWN,this.onItemFactorClick,this);
                }else{
                    item.node.off(cc.Node.EventType.MOUSE_DOWN,this.onItemFactorClick,this);
                }
            }
            for(var item of this.item2){
                if(flag){
                    item.node.on(cc.Node.EventType.MOUSE_DOWN,this.onItemFactorClick,this);
                }else{
                    item.node.off(cc.Node.EventType.MOUSE_DOWN,this.onItemFactorClick,this);
                }
            }
        }else{
            for(var item of this.item1){
                if(flag){
                    item.node.on(cc.Node.EventType.MOUSE_DOWN,this.onItem1Click,this);
                }else{
                    item.node.off(cc.Node.EventType.MOUSE_DOWN,this.onItem1Click,this);
                }
            }
            for(var item of this.item2){
                if(flag){
                    item.node.on(cc.Node.EventType.MOUSE_DOWN,this.onItem2Click,this);
                }else{
                    item.node.off(cc.Node.EventType.MOUSE_DOWN,this.onItem2Click,this);
                }
            }
        }
        
    }

    setData(data: MatchData) {
        this.data = data;
        this.title.string = `第${data.index + 1}场`;
    }

    dragGuantu(guantu:GuantuFactorItem){
        if(this.selecteddGuanty){
            this.selecteddGuanty.node.active = true;
            this.selecteddGuanty.node.x = this.selecteddGuanty.startPoint.x;
            this.selecteddGuanty.node.y = this.selecteddGuanty.startPoint.y;
        }

        this.selecteddGuanty = guantu;
        guantu.node.active = false;

        for(var i = 0;i<this.item1.length;i++){
            var item = this.item1[i];
            if(i < guantu.data.factors.length && guantu.data.factors[i]){
                item.loadSprite(guantu.data.factors[i]);
                item.node.active = true;
            }else{
                item.node.active = false;
            }
        }
    }
    dragGuantu2(guantu:GuantuFactorItem){
        if(this.selecteddGuanty2){
            this.selecteddGuanty2.node.active = true;
            this.selecteddGuanty2.node.x = this.selecteddGuanty2.startPoint.x;
            this.selecteddGuanty2.node.y = this.selecteddGuanty2.startPoint.y;
        }

        this.selecteddGuanty2 = guantu;
        guantu.node.active = false;

        for(var i = 0;i<this.item2.length;i++){
            var item = this.item2[i];
            if(i < guantu.data.factors.length && guantu.data.factors[i]){
                item.loadSprite(guantu.data.factors[i]);
                item.node.active = true;
            }else{
                item.node.active = false;
            }
        }
    }

    toGame(){
        this.btnWin1.node.active = true;
        this.btnWin2.node.active = true;
        this.btnLose.node.active = true;

        //随机AI
        var arr = ["P","T","Z"];
        var index = Math.floor(Math.random() * arr.length);
        this.title.string = `第${this.data.index + 1}场 ${this.mapItem.picName} ${arr[index]}`;

        this.addEvents(false);
    }

    onWin1Click(){
        this.btnWin1.node.active = false;
        this.btnWin2.node.active = false;
        this.btnLose.node.active = false;
        this.result.node.active = true;
        this.result.string = "胜利";
    }

    onWin2Click(){
        this.btnWin1.node.active = false;
        this.btnWin2.node.active = false;
        this.btnLose.node.active = false;
        this.result.node.active = true;
        this.result.string = "带奖励胜利";
    }

    onLoseClick(){
        this.btnWin1.node.active = false;
        this.btnWin2.node.active = false;
        this.btnLose.node.active = false;
        this.result.node.active = true;
        this.result.string = "失败";
    }

    onItem1Click(){
        if(this.selecteddGuanty){
            this.selecteddGuanty.node.active = true;
            this.selecteddGuanty.node.x = this.selecteddGuanty.startPoint.x;
            this.selecteddGuanty.node.y = this.selecteddGuanty.startPoint.y;
        }
        for(var i = 0;i<this.item1.length;i++){
            var item = this.item1[i];
            item.loadSprite(null);
        }
    }
    onItem2Click(){
        if(this.selecteddGuanty2){
            this.selecteddGuanty2.node.active = true;
            this.selecteddGuanty2.node.x = this.selecteddGuanty2.startPoint.x;
            this.selecteddGuanty2.node.y = this.selecteddGuanty2.startPoint.y;
        }
        for(var i = 0;i<this.item2.length;i++){
            var item = this.item2[i];
            item.loadSprite(null);
        }
    }
    onItemFactorClick(evt:cc.Event.EventMouse){
        var item = (evt.target as cc.Node).getComponent(FactorItem);
        if(item.selectedFactor){
            item.selectedFactor.node.active = true;
            item.selectedFactor.node.x = item.selectedFactor.startPoint.x;
            item.selectedFactor.node.y = item.selectedFactor.startPoint.y;
            item.selectedFactor = null;
            item.loadSprite(null);
        }
    }
}