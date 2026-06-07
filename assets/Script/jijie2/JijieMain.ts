import JijieControl from "./JijieContro";
import JJConfigData from "./data/JJConfigData";

const {ccclass, property} = cc._decorator;

@ccclass
export default class JijieMain extends cc.Component {

    @property(cc.TextAsset)
    ruleTxt:cc.TextAsset = null;
    @property(cc.TextAsset)
    mapTxt:cc.TextAsset = null;
    @property(cc.TextAsset)
    commanderTxt:cc.TextAsset = null;
    @property(cc.TextAsset)
    commandeBanTxt:cc.TextAsset = null;
    @property(cc.TextAsset)
    factorTxt:cc.TextAsset = null;

    @property(cc.Prefab)
    factorPrefab:cc.Prefab = null;
    @property(cc.Prefab)
    commanderPrefab:cc.Prefab = null;

    static instance:JijieMain;
    static istage:cc.Node;


    protected onLoad(): void {
        cc.game.setFrameRate(59.9);
        cc.debug.setDisplayStats(false);
        JijieMain.instance = this;
        JijieMain.istage = this.node;

        JJConfigData.init(this.ruleTxt.text,this.mapTxt.text,this.commanderTxt.text,this.factorTxt.text,this.commandeBanTxt.text);
        JijieControl.show(this.node);
    }
}