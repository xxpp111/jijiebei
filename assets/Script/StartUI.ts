import HuiguiData from "./HuiguiData";
import Main from "./Main";

const{ccclass,property} = cc._decorator;

@ccclass
export default class StartUI extends cc.Component{

    @property(cc.EditBox)
    txtPlayerName:cc.EditBox = null;

    // @property(cc.Button)
    // btnGuantu:cc.Button = null;
    // @property(cc.Button)
    // btnZhengjiu:cc.Button = null;
    // @property(cc.Button)
    // btnDanshua:cc.Button = null;
    // @property(cc.Button)
    // btnShuangda:cc.Button = null;

    onStart(){
        
    }

    onGuantuClick(){
        HuiguiData.initGuantuData(this.txtPlayerName.string,false);
        this.node.parent = null;
        Main.instance.toGuantu();
    }

    onGuantuTiaozhanClick(){
        HuiguiData.initGuantuData(this.txtPlayerName.string,true);
        this.node.parent = null;
        Main.instance.toGuantu();
    }

    onDanshuaClick(){
        HuiguiData.initDanshuaData(this.txtPlayerName.string);
        this.node.parent = null;
        Main.instance.toGuantu();
    }

    onShuangdaClick(){
        HuiguiData.initShuangdaData(this.txtPlayerName.string);
        this.node.parent = null;
        Main.instance.toGuantu();
    }
}