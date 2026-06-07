import URLSprite from "./URLSprite";

const { ccclass, property } = cc._decorator;

@ccclass
export default class LCommanderItem extends cc.Component {
	@property(cc.Node)
	public selectBorder: cc.Node = null;

	public index: number;
	public spHead: URLSprite;
	public cname: string;
	public selected: boolean;


	init(name: string = null, count = 0) {
		this.updateSelect(false);

		this.initName(name);
	}

	public initName(name: string): void {
		if (this.spHead) {
			this.spHead.parent = null
			this.spHead = null;
		}
		if (name == null) {
			this.cname = null;
			return;
		}

		this.spHead = new URLSprite("images/commander/" + name + ".png", 33, 33);
		this.node.addChild(this.spHead);

		this.cname = name;
	}

	public updateSelect(flag: boolean): void {
		this.selected = flag;
		this.selectBorder.active = flag;
	}

	public setCName(name: string): void {
		if (name == null) {
			return;
		}
		if (this.spHead) {
			this.node.removeChild(this.spHead);
		}
		this.spHead = new URLSprite("images/commander/" + name + ".png", 33, 33);
		this.node.addChild(this.spHead);
		this.cname = name;
		this.updateSelect(false);
	}
}