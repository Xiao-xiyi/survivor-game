import { _decorator, Component, Node, Label, Input, input, KeyCode, EventKeyboard, director, sys } from 'cc'
const { ccclass, property } = _decorator
import { debug as ccDebug } from 'cc'
import { GameState } from './GameState'
@ccclass('StartPanel')
export class StartPanel extends Component {
    static instance: StartPanel = null
    @property({ type: Node, tooltip: '开始面板（开局显示）' })
    panel: Node = null

    @property({ type: Label, tooltip: '最高分文字' })
    bestLabel: Label = null

    private best = 0

    onLoad() {
        // ccDebug.setDisplayStats(true)
        StartPanel.instance = this
        // 1. 读存档：localStorage 里存的永远是字符串，必须 Number() 转回数字
        const s = sys.localStorage.getItem('survival_best')
        this.best = s ? Number(s) : 0
        this.bestLabel.string = `最高分 ${this.best} 秒`
        GameState.started = false        // 每次进场景，重新回到"菜单状态"
        // 2. 开局标准动作：面板显示 + 冻结全场
        this.panel.active = true
        director.pause()
        // 3. 听键盘
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this)
    }

    onDestroy() {
        if (StartPanel.instance === this) StartPanel.instance = null
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this)
    }

    onKeyDown(e: EventKeyboard) {
        if (!this.panel.active) return
        if (e.keyCode === KeyCode.SPACE) {
            GameState.started = true
            this.panel.active = false
            director.resume()
        }
    }

    // 游戏结束时 HUD 会调它：破了纪录才写回存档
    saveBest(sec: number) {
        if (sec > this.best) {
            this.best = sec
            sys.localStorage.setItem('survival_best', String(sec))
        }
        this.bestLabel.string = `最高分 ${this.best} 秒`
    }
}