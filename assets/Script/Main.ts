import ConfigData from "./ConfigData";
import GuantuUI from "./guantu/GuantuUI";
import MatchItem from "./guantu/view/MatchItem";
import ResultUI from "./guantu/view/ResultUI";

const {ccclass, property} = cc._decorator;

@ccclass
export default class Main extends cc.Component {

    @property(cc.TextAsset)
    guantuTxt:cc.TextAsset = null;
    @property(cc.TextAsset)
    mapTxt:cc.TextAsset = null;
    @property(cc.TextAsset)
    commanderTxt:cc.TextAsset = null;
    @property(cc.TextAsset)
    commandeAbcTxt:cc.TextAsset = null;
    @property(cc.TextAsset)
    factorTxt:cc.TextAsset = null;


    @property(cc.Prefab)
    startUI:cc.Prefab = null;
    @property(cc.Prefab)
    guantuUI:cc.Prefab = null;
    @property(cc.Prefab)
    resultUI:cc.Prefab = null;
    @property(cc.Prefab)
    mapPrefab:cc.Prefab = null;
    @property(cc.Prefab)
    factorPrefab:cc.Prefab = null;
    @property(cc.Prefab)
    guantufactorPrefab:cc.Prefab = null;
    @property(cc.Prefab)
    commanderPrefab:cc.Prefab = null;
    @property(cc.Prefab)
    matchPrefab1:cc.Prefab = null;
    @property(cc.Prefab)
    matchPrefab2:cc.Prefab = null;

    static instance:Main;


    protected onLoad(): void {
        cc.game.setFrameRate(59.9);
        cc.debug.setDisplayStats(false);
        Main.instance = this;
        
        this.toStart();
    }

    toStart(){
        ConfigData.init(this.guantuTxt.text,this.mapTxt.text,this.commanderTxt.text,this.factorTxt.text,this.commandeAbcTxt.text);
        var node = cc.instantiate(this.startUI);
        this.node.addChild(node);
    }

    toGuantu(){
        var node = cc.instantiate(this.guantuUI);
        this.node.addChild(node);

        var comp = node.getComponent(GuantuUI);
        comp.initUI();
    }

    toResult(list:MatchItem[]){
        var node = cc.instantiate(this.resultUI);
        this.node.addChild(node);

        var comp = node.getComponent(ResultUI);
        comp.initUI(list);
    }
}
