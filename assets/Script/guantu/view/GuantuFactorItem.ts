import GuantuInfo from "../../data/GuantoInfo";
import FactorItem from "./FactorItem";

const{ccclass,property} = cc._decorator;

@ccclass
export default class GuantuFactorItem extends cc.Component{

    @property([FactorItem])
    item1:FactorItem[] = [null,null,null]

    @property(cc.Label)
    txt:cc.Label = null;
    @property(cc.Label)
    txt2:cc.Label = null;

    data:GuantuInfo;
    startPoint:cc.Vec2;

    setData(data:GuantuInfo){
        this.data = data;

        this.txt.string = data.name;

        for(var i = 0;i<this.item1.length;i++){
            var item = this.item1[i];
            if(i < data.factors.length && data.factors[i]){
                item.loadSprite(data.factors[i]);
            }else{
                item.node.active = false;
            }
        }

        if(data.author){
            this.txt2.string = "by: "+data.author;
        }else{
            this.txt2.node.active = false;
        }
    }
}