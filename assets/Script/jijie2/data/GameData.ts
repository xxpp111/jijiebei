import PlayerData from "./PlayerData";

export default class GameData {
	public static turn: number;
	/**-1:决定先手 0:买英雄 1:等待扔色子 2:扔骰子中  3:跳格中 4:获得因子中 45:选择因子  
	 * 5:开始战斗 6:战斗等待 7:战斗结束 8:游戏结束 
	 * 10:特殊事件*/
	public static turnStatus: number;
	public static turnFrame: number;
	public static players: PlayerData[];
	public static curPlayerIndex: number;
	public static firstIndex: number;

	public static commandUsed: any;

	public static curMoveStep: number;
	public static curMoved: number;
	public static curFactor: string;
	public static battleCommander: number;
	public static battleFactors: any[];
	public static battleMap: string;
	public static battleBones: boolean;
	public static battleScore: number;

	public static initAndReset(): void {
		this.turn = 1;
		this.turnStatus = 1;
		this.turnFrame = 0;

		this.players = [];
		this.players.push(new PlayerData(0));
		this.players.push(new PlayerData(1));

		this.curPlayerIndex = 0;

		this.commandUsed = {};
	}

	public static getCurPlayer(): PlayerData {
		var index: number = this.curPlayerIndex + this.firstIndex;
		index = index % this.players.length;
		return this.players[index];
	}

	public static getOtherPlayer(): PlayerData {
		var index: number = this.curPlayerIndex + this.firstIndex;
		index = index % this.players.length;
		return this.players[1 - index];
	}
}