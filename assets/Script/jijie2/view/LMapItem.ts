import URLSprite from "./URLSprite";

const { ccclass, property } = cc._decorator;

@ccclass
export default class LMapItem extends cc.Component {
	@property(cc.Node)
	public sp: cc.Node = null;
	public selected: boolean;
	// @property(cc.Node)
	// public banSp: cc.Node = null;
	// @property(cc.Node)
	// public pickSp: cc.Node = null;

	public ox: number;

	public factorName: string;

	onLoad(factorName: string = null) {

		if (factorName) {
			this.factorName = factorName;
			this.sp.addChild(new URLSprite("images/maps/" + factorName + ".png", 204, 74));

			this.ox = this.sp.x;
		}
		// this.banSp.active = false;
		// this.pickSp.active = false;

	}

	public loadMap(factorName: string): void {
		this.factorName = factorName;
		this.sp.addChild(new URLSprite("images/maps/" + factorName + ".png", 204, 74, -102, 37));
		this.ox = this.sp.x;
	}

	// public updateSelectNone(): void {
	// 	this.sp.x = this.ox;
	// 	this.banSp.active = false;
	// 	this.pickSp.active = false;
	// 	this.selected = false;
	// }
	// public updateSelectBan(): void {
	// 	this.sp.x = this.ox;
	// 	this.banSp.active = true;
	// 	this.selected = true;
	// }
	// public updateSelectPick(): void {
	// 	//sp.x = ox - 50;
	// 	this.pickSp.active = true;
	// 	this.selected = true;
	// }
}