const { ccclass, property } = cc._decorator;

@ccclass
export default class URLSprite extends cc.Node {
    public twidth: number;
    public theight: number;
    public id: number;

    constructor(url: string, width: number, height: number, x: number = 0, y: number = 0, id = 0) {
        super();
        url = url.replace(".png","");
        cc.resources.load(url, cc.SpriteFrame, (err: Error, asset: cc.SpriteFrame) => {
            if (err) {

            } else {
                var sprite = this.addComponent(cc.Sprite);
                sprite.spriteFrame = asset;
                this.scaleX = width / sprite.spriteFrame.getOriginalSize().width;
                this.scaleY = height / sprite.spriteFrame.getOriginalSize().height;
            }
        })

        this.twidth = width;
        this.theight = height;
        this.x = x;
        this.y = y;
        this.id = id;
        this.anchorX = 0;
        this.anchorY = 1;
        this.setContentSize(this.twidth,this.theight);
    }
}