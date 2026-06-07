import URLSprite from "./URLSprite";

const { ccclass, property } = cc._decorator;

@ccclass
export default class LFactorItem extends cc.Component {
	@property(cc.Node)
	public sp: cc.Node = null;
	public selected: boolean;
	@property(cc.Node)
	public lockSp: cc.Node = null;

	public oy: number;

	public factorName: string;

	onLoad(factorName: string = null) {

		if (factorName) {
			cc.log("因子:" + factorName);
			this.factorName = factorName;
			this.sp.addChild(new URLSprite("images/factor/" + factorName + ".png", 60, 60));

			this.oy = this.sp.y;
		}

		this.lockSp.active = false;

	}

	public loadFactor(factorName: string): void {
		this.factorName = factorName;
		this.sp.addChild(new URLSprite("images/factor/" + factorName + ".png", 60, 60, -30, 30));

		this.oy = this.sp.y;
	}

	// public updateSelectNone(): void {
	// 	this.sp.y = this.oy;
	// 	this.banSp.active = false;
	// 	this.pickSp.active = false;
	// 	this.lockSp.active = false;
	// 	this.selected = false;
	// }
	// public updateSelectBan(): void {
	// 	this.sp.y = this.oy;
	// 	this.banSp.active = true;
	// 	this.selected = true;
	// }
	// public updateSelectPick(): void {
	// 	//sp.y = oy - 30;
	// 	this.pickSp.active = true;
	// 	this.selected = true;
	// }
	public updateSelectLock(): void {
		this.lockSp.active = true;
		//sp.y = oy - 30;
		this.selected = true;
	}
}