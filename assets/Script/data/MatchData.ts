export default class MatchData{
    index:number;
    cmd1:string;
    isShuang:boolean;
    cmd2:string;
    map:string;
    factorCount:number;
    race:string;
    guantuName:string;

    result:number;

    constructor(index:number,isShuang:boolean,factorCount:number){
        this.index = index;
        this.isShuang = isShuang;
        this.factorCount = factorCount;
    }
}