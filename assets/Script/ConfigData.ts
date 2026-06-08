import CommanderInfo from "./data/CommanderInfo";
import GuantuInfo from "./data/GuantoInfo";
import MapInfo from "./data/MapInfo";

export default class ConfigData{

    static guantuList:GuantuInfo[];
    static guantuTiaozhanList:GuantuInfo[];
    static mapList2:MapInfo[];
    static mapList1:MapInfo[];
    static commanderList:CommanderInfo[];
    static commanderAbcList:CommanderInfo[];
    static factorMap1:{[key:string]:string[]};
    static allFactor:string[];
    static factorMap2:{[key:string]:string[]};

    static init(text:string,maptext:string,commandertext:string,factortext:string,commanderabctext:string){
        this.guantuList = [];
        this.guantuTiaozhanList = [];
        var strs = text.split("\r\n");
        for(var i = 1;i<strs.length;i++){
            var strs2 = strs[i].split("\t");
            if(strs2.length < 2) continue;
            var info = new GuantuInfo();
            info.id = +strs2[0];
            info.name = strs2[1].split(" ")[0];
            info.map = strs2[2];
            info.factors = [];
            if(strs2[3]){
                info.factors.push(strs2[3]);
            }
            if(strs2[4]){
                info.factors.push(strs2[4]);
            }
            if(strs2[5]){
                info.factors.push(strs2[5]);
            }
            if(strs2[6]){
                info.factors.push(strs2[6]);
            }
            if(strs2[8]){
                info.author = strs2[8];
            }

            if(info.id < 200){
                this.guantuList.push(info);
            }
            this.guantuTiaozhanList.push(info);
        }


        this.mapList1 = [];
        this.mapList2 = [];
        var strs = maptext.split("\r\n");
        for(var i = 1;i<strs.length;i++){
            var strs2 = strs[i].split(",");
            if(strs2.length < 2) continue;
            var map = new MapInfo();
            map.id = i;
            map.name = strs2[0];
            if(strs2[1] == "1"){
                this.mapList2.push(map);
            }
            if(strs2[2] == "1"){
                this.mapList1.push(map);
            }
        }

        this.commanderList = [];
        var strs = commandertext.split("\r\n");
        for(var i = 1;i<strs.length;i++){
            var strs2 = strs[i].split(",");
            if(strs2.length < 2) continue;
            var cmd = new CommanderInfo();
            cmd.id = i;
            cmd.name = strs2[0];
            // cmd.rankJijie = strs2[1];
            // cmd.zhongzu = strs2[2];
            cmd.rankHuigui = strs2[1];
            this.commanderList.push(cmd);
        }

        this.commanderAbcList = [];
        var strs = commanderabctext.split("\r\n");
        for(var i = 1;i<strs.length;i++){
            var strs2 = strs[i].split(",");
            if(strs2.length < 2) continue;
            var cmd = new CommanderInfo();
            cmd.id = i;
            cmd.name = strs2[0];
            cmd.rankJijie = strs2[1];
            cmd.zhongzu = strs2[2];
            cmd.rankHuigui = strs2[3];
            this.commanderAbcList.push(cmd);
        }

        this.factorMap1 = {};
        this.factorMap2 = {};
        this.allFactor = [];
        var strs = factortext.split("\r\n");
        for(var i = 1;i<strs.length;i++){
            var strs2 = strs[i].split(",");
            if(strs2[1]){
                var list = this.factorMap2[strs2[1]];
                if(!list){
                    list = [];
                    this.factorMap2[strs2[1]] = list;
                }
                list.push(strs2[0]);
            }
            if(strs2[2]){
                var list = this.factorMap1[strs2[2]];
                if(!list){
                    list = [];
                    this.factorMap1[strs2[2]] = list;
                }
                list.push(strs2[0]);
            }
            this.allFactor.push(strs2[0]);
        }
    }
}