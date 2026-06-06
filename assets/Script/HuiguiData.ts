import ConfigData from "./ConfigData";
import CommanderInfo from "./data/CommanderInfo";
import GuantuInfo from "./data/GuantoInfo";
import MapInfo from "./data/MapInfo";
import MatchData from "./data/MatchData";

export default class HuiguiData {

    static gameType: string;
    static playerName: string;

    static matchList: MatchData[];
    static randomCommanders: CommanderInfo[];
    static randomMaps: MapInfo[];
    static randomGuantus: GuantuInfo[];
    static randomFactors: string[];

    static initGuantuData(playerName: string, isTiaozhan: boolean) {
        this.playerName = playerName;
        this.gameType = isTiaozhan ? "官突挑战" : "官突模式";
        var guantuList = isTiaozhan ? ConfigData.guantuTiaozhanList : ConfigData.guantuList;
        //抽取4个突变
        this.randomGuantus = [];
        for (var i = 0; i < 4; i++) {
            var index = Math.floor(Math.random() * guantuList.length);
            this.randomGuantus.push(guantuList[index]);
            guantuList.splice(index, 1);
        }

        if (isTiaozhan) {
            //抽取12个指挥官
            this.randomCommanders = [];
            var list = ConfigData.commanderList;
            for (var i = 0; i < 5; i++) {
                var index = Math.floor(Math.random() * list.length);
                if (list[index].rankHuigui != "S") {
                    i--;
                    continue;
                }
                this.randomCommanders.push(list[index]);
                list.splice(index, 1);
            }
            for (var i = 0; i < 5; i++) {
                var index = Math.floor(Math.random() * list.length);
                if (list[index].rankHuigui != "A") {
                    i--;
                    continue;
                }
                this.randomCommanders.push(list[index]);
                list.splice(index, 1);
            }
            for (var i = 0; i < 10; i++) {
                var index = Math.floor(Math.random() * list.length);
                if (list[index].rankHuigui != "B") {
                    i--;
                    continue;
                }
                this.randomCommanders.push(list[index]);
                list.splice(index, 1);
            }
            for (var i = 0; i < 5; i++) {
                var index = Math.floor(Math.random() * list.length);
                if (list[index].rankHuigui != "C") {
                    i--;
                    continue;
                }
                this.randomCommanders.push(list[index]);
                list.splice(index, 1);
            }
            for (var i = 0; i < 5; i++) {
                var index = Math.floor(Math.random() * list.length);
                if (list[index].rankHuigui != "O") {
                    i--;
                    continue;
                }
                this.randomCommanders.push(list[index]);
                list.splice(index, 1);
            }
        } else {
            this.randomCommanders = [];
            var list = ConfigData.commanderAbcList;
            for (var i = 0; i < 4; i++) {
                var index = Math.floor(Math.random() * list.length);
                if (list[index].rankHuigui != "A") {
                    i--;
                    continue;
                }
                this.randomCommanders.push(list[index]);
                list.splice(index, 1);
            }
            for (var i = 0; i < 4; i++) {
                var index = Math.floor(Math.random() * list.length);
                if (list[index].rankHuigui != "B") {
                    i--;
                    continue;
                }
                this.randomCommanders.push(list[index]);
                list.splice(index, 1);
            }
            for (var i = 0; i < 3; i++) {
                var index = Math.floor(Math.random() * list.length);
                if (list[index].rankHuigui != "C") {
                    i--;
                    continue;
                }
                this.randomCommanders.push(list[index]);
                list.splice(index, 1);
            }
        }

        //抽取3个地图
        this.randomMaps = [];
        for (var i = 0; i < 2; i++) {
            var index = Math.floor(Math.random() * ConfigData.mapList2.length);
            this.randomMaps.push(ConfigData.mapList2[index]);
            ConfigData.mapList2.splice(index, 1);
        }

        //初始化2个match
        this.matchList = [new MatchData(0, true, 3), new MatchData(1, true, 3)];
    }

    static initDanshuaData(playerName: string) {
        this.playerName = playerName;
        this.gameType = "单刷模式";
        var guantuList = ConfigData.factorMap1;
        //抽取2个困难因子
        this.randomFactors = [];
        for (var i = 0; i < 2; i++) {
            var index = Math.floor(Math.random() * guantuList["困难"].length);
            this.randomFactors.push(guantuList["困难"][index]);
            guantuList["困难"].splice(index, 1);
        }
        for (var i = 0; i < 3; i++) {
            var index = Math.floor(Math.random() * guantuList["一般"].length);
            this.randomFactors.push(guantuList["一般"][index]);
            guantuList["一般"].splice(index, 1);
        }
        for (var i = 0; i < 1; i++) {
            var index = Math.floor(Math.random() * guantuList["简单"].length);
            this.randomFactors.push(guantuList["简单"][index]);
            guantuList["简单"].splice(index, 1);
        }
        for (var i = 0; i < 1; i++) {
            var index = Math.floor(Math.random() * guantuList["环境"].length);
            this.randomFactors.push(guantuList["环境"][index]);
            guantuList["环境"].splice(index, 1);
        }

        //抽取12个指挥官
        this.randomCommanders = [];
        var list = ConfigData.commanderList;
        for (var i = 0; i < 5; i++) {
            var index = Math.floor(Math.random() * list.length);
            if (list[index].rankHuigui != "S") {
                i--;
                continue;
            }
            this.randomCommanders.push(list[index]);
            list.splice(index, 1);
        }
        for (var i = 0; i < 5; i++) {
            var index = Math.floor(Math.random() * list.length);
            if (list[index].rankHuigui != "A") {
                i--;
                continue;
            }
            this.randomCommanders.push(list[index]);
            list.splice(index, 1);
        }
        for (var i = 0; i < 10; i++) {
            var index = Math.floor(Math.random() * list.length);
            if (list[index].rankHuigui != "B") {
                i--;
                continue;
            }
            this.randomCommanders.push(list[index]);
            list.splice(index, 1);
        }
        for (var i = 0; i < 5; i++) {
            var index = Math.floor(Math.random() * list.length);
            if (list[index].rankHuigui != "C") {
                i--;
                continue;
            }
            this.randomCommanders.push(list[index]);
            list.splice(index, 1);
        }
        for (var i = 0; i < 5; i++) {
            var index = Math.floor(Math.random() * list.length);
            if (list[index].rankHuigui != "O") {
                i--;
                continue;
            }
            this.randomCommanders.push(list[index]);
            list.splice(index, 1);
        }

        //抽取3个地图
        this.randomMaps = [];
        for (var i = 0; i < 2; i++) {
            var index = Math.floor(Math.random() * ConfigData.mapList1.length);
            this.randomMaps.push(ConfigData.mapList1[index]);
            ConfigData.mapList1.splice(index, 1);
        }

        //初始化2个match
        this.matchList = [new MatchData(0, false, 3), new MatchData(1, false, 4)];
    }

    static initShuangdaData(playerName: string) {
        this.playerName = playerName;
        this.gameType = "双打模式";
        var guantuList = ConfigData.factorMap2;
        //抽取2个困难因子
        this.randomFactors = [];
        for (var i = 0; i < 4; i++) {
            var index = Math.floor(Math.random() * guantuList["困难"].length);
            this.randomFactors.push(guantuList["困难"][index]);
            guantuList["困难"].splice(index, 1);
        }
        for (var i = 0; i < 5; i++) {
            var index = Math.floor(Math.random() * guantuList["一般"].length);
            this.randomFactors.push(guantuList["一般"][index]);
            guantuList["一般"].splice(index, 1);
        }
        for (var i = 0; i < 2; i++) {
            var index = Math.floor(Math.random() * guantuList["简单"].length);
            this.randomFactors.push(guantuList["简单"][index]);
            guantuList["简单"].splice(index, 1);
        }
        for (var i = 0; i < 2; i++) {
            var index = Math.floor(Math.random() * guantuList["环境"].length);
            this.randomFactors.push(guantuList["环境"][index]);
            guantuList["环境"].splice(index, 1);
        }

        //抽取12个指挥官
        this.randomCommanders = [];
        var list = ConfigData.commanderList;
        for (var i = 0; i < 5; i++) {
            var index = Math.floor(Math.random() * list.length);
            if (list[index].rankHuigui != "S") {
                i--;
                continue;
            }
            this.randomCommanders.push(list[index]);
            list.splice(index, 1);
        }
        for (var i = 0; i < 5; i++) {
            var index = Math.floor(Math.random() * list.length);
            if (list[index].rankHuigui != "A") {
                i--;
                continue;
            }
            this.randomCommanders.push(list[index]);
            list.splice(index, 1);
        }
        for (var i = 0; i < 10; i++) {
            var index = Math.floor(Math.random() * list.length);
            if (list[index].rankHuigui != "B") {
                i--;
                continue;
            }
            this.randomCommanders.push(list[index]);
            list.splice(index, 1);
        }
        for (var i = 0; i < 5; i++) {
            var index = Math.floor(Math.random() * list.length);
            if (list[index].rankHuigui != "C") {
                i--;
                continue;
            }
            this.randomCommanders.push(list[index]);
            list.splice(index, 1);
        }
        for (var i = 0; i < 5; i++) {
            var index = Math.floor(Math.random() * list.length);
            if (list[index].rankHuigui != "O") {
                i--;
                continue;
            }
            this.randomCommanders.push(list[index]);
            list.splice(index, 1);
        }

        //抽取3个地图
        this.randomMaps = [];
        for (var i = 0; i < 2; i++) {
            var index = Math.floor(Math.random() * ConfigData.mapList2.length);
            this.randomMaps.push(ConfigData.mapList2[index]);
            ConfigData.mapList2.splice(index, 1);
        }

        //初始化2个match
        this.matchList = [new MatchData(0, true, 6), new MatchData(1, true, 7)];
    }
}