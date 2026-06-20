// [legacy/web 副本] 源 = assets/Script/jijie2/data/JJConfigData.ts（XP/Cocos 知识成果，原件只读保留，致敬原作者）。
// web 运行期适配：断 GameData 死链——删原件 `import GameData` 与唯一消费者 calcCurrentScore()（web/src 零引用）。
// 抽签引擎逻辑（init/getJijieFactor/getLushiFactor/getFactorByScore/popMap/popFactor…）逐字保留。详见同目录 README.md。

export default class JJConfigData {
    /**0:名字 */
    public static userList: any[];
    /**0:名字 1:等级 */
    public static factorList: any[];
    public static factorList_back: any[];
    /**0:名字 1:价格 2:得分*/
    public static commanderList: any[];

    public static commadnerGroupList: Object;
    /**0:id 1:类型 2:地图 3:因子 4:图片 5:横坐标 6:纵坐标*/
    public static mapGrid: any[];
    /**
     * 初始金钱
     * 强制开战因子数
     * 拒绝机会
     * 基础奖金系数
     * 单因子奖励
     * 双因子奖励
     * 强制结束
     */
    public static paramMap: Object;

    public static init(ruletext: string, maptext: string, commandertext: string, factortext: string, commanderbantext: string): void {
        //userList = getStrArrFromFile("参赛选手.csv");
        this.initFactor(factortext);
        this.commanderList = this.getStrArrFromFile(commandertext);
        this.mapGrid = this.getStrArrFromFile(maptext);
        var params: any[] = this.getStrArrFromFile(ruletext);
        this.paramMap = {};
        for (var arr of params) {
            this.paramMap[arr[0]] = Number(arr[1]);
        }

        var banList = this.getStrArrFromFile(commanderbantext);

        this.commadnerGroupList = new Object();
        for (var i: number = 0; i < this.commanderList.length; i++) {
            arr = this.commanderList[i];
            //检查是否被ban
            var isBan = false;
            for (var banArr of banList) {
                if (banArr[0] == arr[0]) {
                    isBan = true;
                    break;
                }
            }
            if (isBan) {
                this.commanderList.splice(i, 1);
                i--;
                continue;
            }


            var group: string = arr[1];
            var vec: string[] = this.commadnerGroupList[group];
            if (vec == null) {
                vec = [];
                this.commadnerGroupList[group] = vec;
            }

            vec.push(arr[0]);
        }
    }

    public static initFactor(text: string) {
        this.factorList = this.getStrArrFromFile(text);
        this.factorList_back = this.getStrArrFromFile(text);
    }

    public static getStrArrFromFile(allstr: string): any[] {
        // trace("read file "+path);

        var result: any[] = [];

        // var fs:FileStream = new FileStream();
        // fs.open(File.applicationDirectory.resolvePath(path),FileMode.READ);
        // var allstr:string = fs.readUTFBytes(fs.bytesAvailable);

        var strs: any[] = allstr.split("\r\n");
        for (var i: number = 1; i < strs.length; i++) {
            var str: string = strs[i];
            if (str != "")
                result.push(str.split(","));
        }

        return result;
    }

    public static getFactorGroup(groupName: string): any[] {
        var result: any[] = [];
        for(var arr of this.factorList) {
            if (arr[1] == groupName) {
                result.push(arr[0]);
            }
        }
        return result;
    }

    public static popFactor(factorName: string): void {
        for (var i: number = 0; i < this.factorList.length; i++) {
            if (this.factorList[i][0] == factorName) {
                this.factorList.splice(i, 1);
                break;
            }
        }
    }

    public static releaseFactor(factorName: string): void {
        for (var i: number = 0; i < this.factorList_back.length; i++) {
            if (this.factorList_back[i][0] == factorName) {
                this.factorList.push(this.factorList_back[i]);
                break;
            }
        }
    }

    public static popMap(mapName: string): void {
        for (var i: number = 0; i < this.mapGrid.length; i++) {
            if (this.mapGrid[i][0] == mapName) {
                this.mapGrid.splice(i, 1);
                break;
            }
        }
    }

    public static releaseMap(mapName: string): void {
        //mapGrid.push([mapName]);
        if (this.mapGrid.length <= 4) {
            this.mapGrid = this.getStrArrFromFile("地图配置.csv");
        }
    }

    public static getJijieFactor(hard: boolean, smallRate = 1): string {
        while (true) {
            var raIndex: number = Math.floor(Math.random() * this.factorList.length);
            var group: number = Number(this.factorList[raIndex][1]);
            var rate: number = this.paramMap[(hard ? "极难" : "") + "因子组" + group + "概率"];
            if (group < 4) {
                rate *= smallRate;
            }

            if (Math.random() < rate) {
                break;
            }
        }


        var factor: string = JJConfigData.factorList[raIndex][0];
        return factor;
    }

    public static getLushiFactor(hard: Boolean) {
        while (true) {
            var raIndex: number = Math.floor(Math.random() * this.factorList.length);
            var group: number = Number(this.factorList[raIndex][1]);
            if (hard && group < 3) {
                continue;
            }
            if (!hard && group > 3) {
                continue;
            }
            var rate: number = this.paramMap[(hard ? "极难" : "") + "因子组" + group + "概率"];

            if (Math.random() < rate) {
                break;
            }
        }


        var factor = JJConfigData.factorList[raIndex];
        JJConfigData.factorList.splice(raIndex, 1);
        return factor;
    }

    public static getFactorByScore(score: number): string {
        var scoreName = score + "";
        var list = [];
        for (var i = 0; i < this.factorList_back.length; i++) {
            if (this.factorList_back[i][2] == scoreName) {
                list.push(this.factorList_back[i][0]);
            }
        }

        var raIndex: number = Math.floor(Math.random() * list.length);
        return list[raIndex];
    }
}
