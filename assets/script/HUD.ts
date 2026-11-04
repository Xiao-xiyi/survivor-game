import { _decorator, Component, director, EventKeyboard, Input, input, KeyCode, Label, Node, Sprite } from 'cc';
import { Player } from './Player';
import { Enemy } from './Enemy';
import { clearPool } from './pool';
const { ccclass, property } = _decorator;

@ccclass('HUD')
export class HUD extends Component {
    @property({ type: Label, tooltip: '等级与经验' })
    expLabel: Label = null

    @property({ type: Sprite, tooltip: '血条（红色那根）' })
    hpBar: Sprite = null

    @property({ type: Label, tooltip: '击杀数' })
    killLabel: Label = null
    @property({ type: Label, tooltip: '存活时间' })
    timeLabel: Label = null



    @property({ type: Node, tooltip: '结算面板（平时关着）' })
    gameOverPanel: Node = null
    @property({ type: Label, tooltip: '结算面板里的成绩文字' })
    resultLabel: Label = null
    private _time: number = 0
    // 上次显示出来的秒数，用来判断"这一帧要不要改文字"
    private _shownSec: number = -1
    // 本局是否已经结束，false 表示还在打
    private _over: boolean = false


    onKeyDown(e: EventKeyboard) {
        if (!this._over) return
        if (e.keyCode === KeyCode.KEY_R) {
            director.loadScene('scenes')
        }
    }

    protected onLoad() {
        Enemy.killed = 0
        Enemy.all.length = 0
        clearPool()
        if (this.gameOverPanel) {
            this.gameOverPanel.active = false
        }
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this) // 订阅键盘按下事件
    }
    protected onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this)  // 取消订阅，和 onLoad 里的 on 成对
    }


    update(dt: number) {
        if (this._over) return
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

        this.expLabel.string = `Lv.${p.level}  经验 ${p.exp}/${p.expNeed}`
        // fillRange 是 0~1，当前血量 / 最大血量
        this.hpBar.fillRange = Math.max(0, p.hp / p.maxHp)
        // 血量为 0 → 弹出结算
        if (p.hp <= 0) this.showGameOver()
    }
    showGameOver() {
        this._over = true
        if (this.resultLabel) {
            this.resultLabel.string = `存活 ${Math.floor(this._time)} 秒\n击杀 ${Enemy.killed}`
        }
        if (this.gameOverPanel) {
            this.gameOverPanel.active = true
        }
    }


}


