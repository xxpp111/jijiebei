import ConfigData from "./JJConfigData";

export default class PlayerData {
	public index: number;
	public name: string;

	public onGrid: number;

	public money: number;
	public scoreWin: number;
	public scoreLose: number;

	public factorList: any[];
	public commanderList: any[];

	public refuseChance: number;

	public roundCount: number;


	constructor(i: number) {
		this.index = i;
		this.refuseChance = i == 0 ? 0 : ConfigData.paramMap["拒绝机会"];
		this.money = ConfigData.paramMap["初始金钱"];
		this.scoreLose = 0;
		this.scoreWin = 0;
		this.factorList = [];
		this.commanderList = [];
		if (ConfigData.userList) {
			this.name = ConfigData.userList[i][0];
		} else {
			this.name = "玩家" + (i + 1);
		}
		this.onGrid = 0;

		this.roundCount = 0;
	}

	public addGrid(step: number): void {
		this.onGrid += step;
		if (this.onGrid >= ConfigData.mapGrid.length) {
			this.onGrid -= ConfigData.mapGrid.length;
		}
	}

	public getGrid(): any[] {
		return ConfigData.mapGrid[this.onGrid];
	}

	public removeFactor(name: String): void {
		this.factorList.splice(this.factorList.indexOf(this.name), 1);
	}
}