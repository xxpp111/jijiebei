const{ccclass,property} = cc._decorator;

@ccclass
export default class MapItem extends cc.Component{

    @property(cc.Node)
    bg:cc.Node = null;
    @property(cc.Sprite)
    sprite:cc.Sprite = null;

    picName:string;
    startPoint:cc.Vec2;

    selectedMap:MapItem;
    
    loadSprite(picName:string){
        this.picName = picName;
        cc.resources.load("images/maps/"+picName,cc.SpriteFrame,(err:Error,asset:cc.SpriteFrame)=>{
            if(err){
                
            }else{
                this.sprite.spriteFrame = asset;
            }
        })
    }

    drag(map:MapItem){
        if(this.selectedMap){
            this.selectedMap.node.active = true;
            this.selectedMap.node.x = this.selectedMap.startPoint.x;
            this.selectedMap.node.y = this.selectedMap.startPoint.y;
        }

        this.selectedMap = map;
        map.node.active = false;

        this.loadSprite(map.picName);
    }
}