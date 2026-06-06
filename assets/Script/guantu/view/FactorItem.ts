const{ccclass,property} = cc._decorator;

@ccclass
export default class FactorItem extends cc.Component{

    @property(cc.Node)
    bg:cc.Node = null;
    @property(cc.Sprite)
    sprite:cc.Sprite = null;
    
    picName:string;
    selectedFactor:FactorItem;
    startPoint:cc.Vec2;

    loadSprite(picName:string){
        this.picName = picName;
        if(!picName){
            this.sprite.spriteFrame = null;
            return;
        }
        cc.resources.load("images/factor/"+picName,cc.SpriteFrame,(err:Error,asset:cc.SpriteFrame)=>{
            if(err){
                
            }else{
                this.sprite.spriteFrame = asset;
            }
        })
    }
}