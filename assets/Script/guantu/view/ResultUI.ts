import Main from "../../Main";
import MatchItem from "./MatchItem";

const{ccclass,property} = cc._decorator;

@ccclass
export default class ResultUI extends cc.Component{

    @property(cc.Label)
    txtPlayer:cc.Label = null;

    @property(cc.Node)
    matchContainer:cc.Node = null;

    @property(cc.Button)
    btnRestart:cc.Button = null;

    initUI(list:MatchItem[]){
        for(var i = 0;i<list.length;i++){
            var item = list[i];
            item.node.x = i * 500;
            item.node.y = 0;
            item.node.parent = null;
            this.matchContainer.addChild(item.node);
        }
    }

    onRestartClick(){
        this.node.active = false;
        Main.instance.toStart();
    }
}