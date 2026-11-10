import { _decorator, Component, Node, Label, Input, input, KeyCode, EventKeyboard, director, sys } from 'cc';
import { GameState } from './GameState';

const { ccclass, property } = _decorator;

/**
 * 开始界面：显示最高分、按空格开始
 * 同时负责"最高分存档"的读写（HUD 结算时会调 saveBest）
 */
@ccclass('StartPanel')
export class StartPanel extends Component {

    /** 单例：HUD 结算时要调 saveBest */
    static instance: StartPanel = null

    // ==================== 一、可配置属性 ====================

    @property({ type: Node, tooltip: '开始面板（开局显示）' })
    panel: Node = null

    @property({ type: Label, tooltip: '最高分文字' })
    bestLabel: Label = null

    // ==================== 二、私有状态 ====================

    /** 当前最高纪录（秒） */
    private best: number = 0

    // ==================== 三、生命周期 ====================

    onLoad(): void {
        StartPanel.instance = this

        // 读存档：localStorage 里存的永远是字符串，必须 Number() 转回数字
        const s = sys.localStorage.getItem('survival_best')
        this.best = s ? Number(s) : 0
        if (this.bestLabel) this.bestLabel.string = `最高分 ${this.best} 秒`

        // 每次进场景都回到"菜单状态"（静态变量不会自动复位）
        GameState.started = false

        // 开局标准动作：面板显示 + 冻结全场
        if (this.panel) this.panel.active = true
        director.pause()

        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this)
    }

    onDestroy(): void {
        if (StartPanel.instance === this) StartPanel.instance = null
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this)
    }

    // ==================== 四、对外接口 ====================

    /** 游戏结束时由 HUD 调用：破了纪录才写回存档 */
    saveBest(sec: number): void {
        if (sec > this.best) {
            this.best = sec
            sys.localStorage.setItem('survival_best', String(sec))
        }
        if (this.bestLabel) this.bestLabel.string = `最高分 ${this.best} 秒`
    }

    // ==================== 五、输入回调 ====================

    private onKeyDown(e: EventKeyboard): void {
        if (!this.panel || !this.panel.active) return
        if (e.keyCode === KeyCode.SPACE) {
            GameState.started = true
            this.panel.active = false
            director.resume()
        }
    }
}