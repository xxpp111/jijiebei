import JJLog from "./JJLog";
import JJUI from "./JJUI";
import JijieData from "./JijieData";
import JijieMain from "./JijieMain";
import ConfigData from "./data/JJConfigData";

export default class JijieControl {

    public static jjUI: JJUI;

    public static show(root:cc.Node): void {
        this.jjUI = root.getChildByName("jjUI").getComponent(JJUI);
        JijieData.initStart();
        this.jjUI.initZero();////////////弹出姓名框 选择因子数

        this.addEvents();

    }

    private static addEvents(): void {
        // this.jjUI.btnRestart.on(cc.Node.EventType.MOUSE_UP, this.onRestart, this);
    }

    private static onRestart(evt: Event): void {
        // JijieMain.istage.removeChild(jjUI);
        // JijieData.reset();
        // ConfigData.init();
        // this.show();
    }

    private static onframe(evt: Event): void {

    }

    public static toStart(): void {
        JijieData.status = 1;
        ////////////////////弹出随机or手选框
        //初始化姓名
        this.jjUI.txtPlayerName.string = "当前选手: " + JijieData.playerName;
        var fcount = JijieData.modelFactorCount == 2 ? 8 : 10;
        if (JijieData.modelFactorCount == 4) {
            fcount = 12;
        }
        this.jjUI.txtMode.string = "比赛模式: " + fcount + "因子";


        if (JijieData.modeIsVeryHard) {
            this.jjUI.txtMode.string = "比赛模式: 极难挑战";
            //没有随机 直接默认手选
            JijieControl.toSelect();

            ConfigData.popMap("营救矿工");
        } else if (JijieData.modeIsZhengjiu) {
            this.jjUI.txtMode.string = "比赛模式: 拯救模式";
            JijieControl.toSelect();
        }

        //随机地图和锁定因子
        var count = 3;///////////////地图数量
        var raIndex;

        for (var i = 0; i < count; i++) {
            while (true) {
                raIndex = Math.floor(Math.random() * ConfigData.mapGrid.length);
                var map: string = ConfigData.mapGrid[raIndex][0];
                var group = Number(ConfigData.mapGrid[raIndex][1]);
                if (JijieData.modelFactorCount == 4 || group == 2 || Math.random() < 0.33) {
                    break;
                } else {
                    cc.log("抛弃地图: " + map);
                }
            }

            ConfigData.popMap(map);
            if (JijieData.modeIsVeryHard) {
                //删除克哈飞机 加亡夜摇篮
                //if(map == "克哈裂痕") map = "死亡摇篮";
                //if(map == "虚空降临") map = "亡者之夜";
            }

            JijieData.mapList.push(map);

        }

        if (JijieData.modelFactorCount == 2) {
            //删除部署，风暴，裂隙因子
            ConfigData.popFactor("风暴英雄");
            ConfigData.popFactor("虚空裂隙");
            ConfigData.popFactor("进攻部署");
        }

        for (var i = 0; i < count; i++) {
            var lockFactor: string;
            if (JijieData.modeZhenghuo) {
                lockFactor = "随机";
            } else if (JijieData.modeFeiqiu) {
                lockFactor = "混乱工作室";
            } else if (i == count - 1 && JijieData.modelFactorCount == 4) {
                lockFactor = ConfigData.getJijieFactor(JijieData.modeIsVeryHard, 0);
            } else {
                lockFactor = ConfigData.getJijieFactor(JijieData.modeIsVeryHard);
            }
            ConfigData.popFactor(lockFactor);
            JijieData.lockFactorList.push(lockFactor);
        }

        //关闭姓名框 下一步监听
        this.jjUI.updateToStart();


    }

    public static toSelect(): void {
        JijieData.status = 2;
        //随机指挥官
        if (JijieData.modeIsOnePick) {
            this.jjUI.map1.spCommander.setCName("自选");
            this.jjUI.map2.spCommander.setCName("自选");
            this.jjUI.map3.spCommander.setCName("自选");
        } else if (JijieData.modeIsZhengjiu) {
            JijieData.randomCommanderPoorA.push("雷诺");
            JijieData.randomCommanderPoorA.push("凯瑞甘");
            JijieData.randomCommanderPoorA.push("阿塔尼斯");
            JijieData.randomCommanderPoorA.push("斯旺");
            JijieData.randomCommanderPoorA.push("沃拉尊");
            JijieData.randomCommanderPoorA.push("斯图科夫");
            JijieData.randomCommanderPoorA.push("米拉");
        } else {
            if (JijieData.modeIsVeryHard && !JijieData.modeIsVeryHard2) {
                JijieData.randomCommanderPoorA = ConfigData.commadnerGroupList["A"];
                JijieData.randomCommanderPoorB = ConfigData.commadnerGroupList["B"];
                //JijieData.randomCommanderPoorC = ConfigData.commadnerGroupList["C"];
            } else {
                var countA = 4;
                var countB = 2;
                var countC = 3;
                if (JijieData.modeSuiji) {
                    countC = 4;
                }
                if (JijieData.modeIsVeryHard2) {
                    countA = 6;
                    countB = 3;
                }

                var raIndex;
                var commander: string;
                var groupList: string[];
                //A组随机
                groupList = ConfigData.commadnerGroupList["A"];
                if (JijieData.modeFeiqiu) {
                    var index = groupList.indexOf("雷诺");
                    groupList.splice(index, 1);
                }
                for (var i = 0; i < countA; i++) {
                    raIndex = Math.floor(Math.random() * groupList.length);
                    commander = groupList[raIndex];
                    JijieData.randomCommanderPoorA.push(commander);
                    groupList.splice(raIndex, 1);
                }
                //B组随机
                groupList = ConfigData.commadnerGroupList["B"];
                if (JijieData.modeFeiqiu) {
                    var index = groupList.indexOf("斯台特曼");
                    groupList.splice(index, 1);
                }
                for (var i = 0; i < countB; i++) {
                    raIndex = Math.floor(Math.random() * groupList.length);
                    commander = groupList[raIndex];
                    JijieData.randomCommanderPoorB.push(commander);
                    groupList.splice(raIndex, 1);
                }
                //C组随机
                //					groupList = ConfigData.commadnerGroupList["C"];
                //					for(var i:int = 0;i<countC;i++){
                //						raIndex = int(Math.random() * groupList.length);
                //						commander = groupList[raIndex];
                //						JijieData.randomCommanderPoorC.push(commander);
                //						groupList.splice(raIndex,1);
                //					}

                if (!JijieData.modeSuiji && !JijieData.modeFeiqiu) {
                    JijieData.randomCommanderPoorA.push("自选");
                }
            }


        }


        //随机因子
        var factorCount = 0;
        if (!JijieData.modeFeiqiu) {
            ConfigData.popFactor("进攻部署");
        }



        var smallRate = 1;
        if (JijieData.modeIsVeryHard) {
            factorCount = ConfigData.paramMap["随机因子数极难"];
            //6选2
            var jinanArr: string[] = ["风暴英雄", "虚空裂隙", "给我死吧", "虚空重生者"];
            for (var i = 0; i < 2; i++) {
                var ra = Math.floor(Math.random() * jinanArr.length);
                var factor: string = jinanArr[ra];
                jinanArr.splice(ra, 1);
                ConfigData.popFactor(factor);
                JijieData.randomFactorPoor.push(factor);
            }
            factorCount -= 2;
        } else if (JijieData.modelFactorCount == 2) {
            factorCount = ConfigData.paramMap["随机因子数7"];
            //删除部署，风暴，裂隙因子
            ConfigData.popFactor("风暴英雄");
            ConfigData.popFactor("虚空裂隙");
            ConfigData.popFactor("进攻部署");
            if (Math.random() < 0.3) {
                ConfigData.popFactor("同化体");
            }
            smallRate = 0.9;
        } else if (JijieData.modelFactorCount == 4) {
            factorCount = ConfigData.paramMap["随机因子数13"];
            if (JijieData.modeIsZhengjiu) {
                ConfigData.popFactor("风暴英雄");
                ConfigData.popFactor("虚空裂隙");
                if (Math.random() < 0.3) {
                    ConfigData.popFactor("同化体");
                }
            }
        } else if (JijieData.modeSuiji) {
            factorCount = 0;
        } else {
            factorCount = ConfigData.paramMap["随机因子数10"];
            if (JijieData.modeIsOnePick) {
                factorCount--;
            }
            if (JijieData.modeIsZhengjiu) {
                ConfigData.popFactor("风暴英雄");
                ConfigData.popFactor("虚空裂隙");
                if (Math.random() < 0.3) {
                    ConfigData.popFactor("同化体");
                }
            }
            smallRate = 0.9;
        }

        if (JijieData.modeIsLanzi) {
            factorCount = 3;
            for (var i = 0; i < factorCount; i++) {
                var factor: string = ConfigData.getFactorByScore(i + 1);
                ConfigData.popFactor(factor);
                JijieData.randomFactorPoor.push(factor);
            }
        } else if (JijieData.modeFeiqiu) {
            JijieData.randomFactorPoor.push("风暴英雄");
            JijieData.randomFactorPoor.push("虚空裂隙");
            JijieData.randomFactorPoor.push("礼尚往来");
        } else {
            for (var i = 0; i < factorCount; i++) {
                var factor: string = ConfigData.getJijieFactor(JijieData.modeIsVeryHard);
                ConfigData.popFactor(factor);
                JijieData.randomFactorPoor.push(factor);
            }
        }


        //初始化Null选择
        var nullFactorCount = JijieData.modelFactorCount * 3 - 2;
        //if(JijieData.modeIsVeryHard){
        //	nullFactorCount = 8;
        //}
        for (var i = 0; i < nullFactorCount; i++) {
            JijieData.selectedFactorList.push(null);
        }
        JijieData.selectedCommanderList.push(null);
        JijieData.selectedCommanderList.push(null);
        JijieData.selectedCommanderList.push(null);

        //更新&下一步监听
        this.jjUI.updateToSelect();
    }

    public static toBattle(): void {
        JijieData.status = 3;

        this.jjUI.toBattle();
    }

    public static showResultLose(): void {
        this.jjUI.txtResult.string = "比赛结束, 获胜" + JijieData.winCount + "场";
        // this.jjUI.btnRestart.active = true;
        this.jjUI.map1.reset();
        this.jjUI.map2.reset();
        this.jjUI.map3.reset();

        var logArr: string[] = [new Date().toString(), JijieData.playerName, (JijieData.modelFactorCount * 3 + 1) + "因子",
        JijieData.modeIsRandom ? "随机" : "手选", "获胜" + JijieData.winCount + "场"];
        JJLog.writeLog(logArr);
    }

    public static showResultEnd(): void {
        this.jjUI.txtResult.string = "比赛结束, 获胜" + JijieData.winCount + "场";
        // this.jjUI.btnRestart.active = true;

        var logArr: string[] = [new Date().toString(), JijieData.playerName, (JijieData.modelFactorCount * 3 + 1) + "因子",
        JijieData.modeIsRandom ? "随机" : "手选", "获胜" + JijieData.winCount + "场"];
        JJLog.writeLog(logArr);
    }

    public static updateBCount(): void {
        var result: boolean = false;
        if (!JijieData.modeIsOnePick && !JijieData.modeIsVeryHard && JijieData.modelFactorCount <= 3) {
            JijieData.pickBCount = 0;
            JijieControl.jjUI.map1.checkBCount();
            JijieControl.jjUI.map2.checkBCount();
            JijieControl.jjUI.map3.checkBCount();
            if (JijieData.pickBCount == 0 && JijieData.modelFactorCount != 3) {
                result = true;
            }
        }
        if (JijieData.modeIsOnePick) {
            var xianchuArr = ["雷诺", "凯瑞甘", "阿塔尼斯", "斯旺", "沃拉尊", "斯图科夫", "米拉"];
            var oneName = this.jjUI.panelSelect.selectedItem.cname;
            if (xianchuArr.indexOf(oneName) >= 0 && JijieData.modelFactorCount != 3) {
                result = true;
            }
        }
        if (this.jjUI.map3.factor4 && this.jjUI.map3.factor4.node.active) {
            //jjUI.map3.factor4.banSp.visible = result;
        } else {
            if(result){
                this.jjUI.map3.factor3.node.active = false;
            }
            // this.jjUI.map3.factor3.banSp.active = result;
        }

    }
}