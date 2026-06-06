const{ccclass,property} = cc._decorator;

@ccclass
export default class CommadnerItem extends cc.Component{

    @property(cc.Node)
    bg:cc.Node = null;
    @property(cc.Sprite)
    sprite:cc.Sprite = null;

    picName:string;
    rank:string;
    startPoint:cc.Vec2;

    selectedCommander:CommadnerItem;
    
    loadSprite(picName:string,rank:string = null){
        this.picName = picName;
        cc.resources.load("images/commander/"+picName,cc.SpriteFrame,(err:Error,asset:cc.SpriteFrame)=>{
            if(err){
                
            }else{
                this.sprite.spriteFrame = asset;
            }
        })

        this.rank = rank;
        
        if(rank == "A"){
            this.bg.color = cc.color(31,20,198);
        }else if(rank == "B"){
            this.bg.color = cc.color(118,15,171);
        }else if(rank == "C"){
            this.bg.color = cc.color(220,136,21);
        }else{
            this.bg.active = false;
        }
    }

    drag(commander:CommadnerItem){
        if(this.selectedCommander){
            this.selectedCommander.node.active = true;
            this.selectedCommander.node.x = this.selectedCommander.startPoint.x;
            this.selectedCommander.node.y = this.selectedCommander.startPoint.y;
        }

        this.selectedCommander = commander;
        commander.node.active = false;

        this.loadSprite(commander.picName,commander.rank);
    }
}