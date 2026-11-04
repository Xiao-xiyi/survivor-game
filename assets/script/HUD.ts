import { _decorator, Component, Label, Node, Sprite } from 'cc';
import { Player } from './Player';
import { Enemy } from './Enemy';
const { ccclass, property } = _decorator;

@ccclass('HUD')
export class HUD extends Component {
    @property({ type: Label, tooltip: '击杀数' })
    killLabel: Label = null
    private _time: number = 0
    // 上次显示出来的秒数，用来判断"这一帧要不要改文字"
    private _shownSec: number = -1

    @property({ type: Label, tooltip: '存活时间' })
    timeLabel: Label = null
    @property({ type: Sprite, tooltip: '血条（红色那根）' })
    hpBar: Sprite = null


    update(dt: number) {
         // 计时
        this._time += dt
        const sec = Math.floor(this._time)
        // 只在秒数变化时才改 Label，不然每秒改 60 次纯属浪费
        if (sec !== this._shownSec) {
            this._shownSec = sec
            this.timeLabel.string = `存活 ${sec} 秒`
        }

        // 击杀数
        this.killLabel.string = `击杀 ${Enemy.killed}`




        const p = Player.instance
        if (!p || !p.node.isValid) return
        // fillRange 是 0~1，当前血量 / 最大血量
        this.hpBar.fillRange = Math.max(0, p.hp / p.maxHp)
    }

}


