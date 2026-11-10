import { _decorator, Component, sys, director, EventKeyboard, Input, input, KeyCode, Label, Node, Sprite } from 'cc';
import { Player } from './Player';
import { Enemy } from './Enemy';
import { clearPool } from './pool';
import { GameState } from './GameState';
import { StartPanel } from './Startpanel';

const { ccclass, property } = _decorator;

/**
 * 界面脚本：血条 / 击杀数 / 存活时间 / 暂停面板 / 结算面板
 * 同时负责：ESC 暂停、结算后按 R 重开、开局复位静态数据
 */
@ccclass('HUD')
export class HUD extends Component {

    // ==================== 一、可配置属性 ====================

    @property({ type: Label, tooltip: '等级与经验' })
    expLabel: Label = null

    @property({ type: Sprite, tooltip: '血条（红色那根）' })
    hpBar: Sprite = null

    @property({ type: Label, tooltip: '击杀数' })
    killLabel: Label = null

    @property({ type: Label, tooltip: '存活时间' })
    timeLabel: Label = null

    @property({ type: Node, tooltip: '暂停面板（平时关着）' })
    pausePanel: Node = null

    @property({ type: Node, tooltip: '结算面板（平时关着）' })
    gameOverPanel: Node = null

    @property({ type: Label, tooltip: '结算面板里的成绩文字' })
    resultLabel: Label = null

    // ==================== 二、私有状态 ====================

    /** 本局存活了多少秒（浮点，显示时再取整） */
    private _time: number = 0

    /** 上次显示出来的秒数，用来判断"这一帧要不要改文字" */
    private _shownSec: number = -1

    /** 上次显示出来的击杀数，同样用来判重 */
    private _shownKill: number = -1

    /** 本局是否已经结束，false 表示还在打 */
    private _over: boolean = false

    // ==================== 三、生命周期 ====================

    protected onLoad(): void {
        // 每局开局把静态数据复位（静态变量不会随场景重建自动清零）
        Enemy.killed = 0
        Enemy.all.length = 0
        GameState.time = 0
        GameState.over = false
        GameState.paused = false     // 万一上一局是暂停状态退出的，这里必须清掉
        clearPool()                  // 对象池也要清空，否则会残留上一局的节点

        if (this.pausePanel) this.pausePanel.active = false
        if (this.gameOverPanel) this.gameOverPanel.active = false

        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this)
    }

    protected onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this)   // 与 onLoad 里的 on 成对
    }

    // ==================== 四、每帧逻辑 ====================

    update(dt: number): void {
        if (!GameState.started) return   // 开始界面不跑
        if (this._over) return           // 结算后冻结

        // 暂停时不走表，否则暂停 10 秒再继续，存活时间凭空多 10 秒
        if (!GameState.paused) {
            this._time += dt
            GameState.time += dt         // 全局时间，难度曲线读它
        }

        const sec = Math.floor(this._time)
        // 只在秒数变化时才改 Label，不然每秒改 60 次纯属浪费
        if (sec !== this._shownSec) {
            this._shownSec = sec
            this.timeLabel.string = `存活 ${sec} 秒`
        }

        // 击杀数同样判重
        if (Enemy.killed !== this._shownKill) {
            this._shownKill = Enemy.killed
            this.killLabel.string = `击杀 ${Enemy.killed}`
        }

        const p = Player.instance
        if (!p || !p.node.isValid) return

        this.expLabel.string = `Lv.${p.level}  经验 ${p.exp}/${p.expNeed}`
        this.hpBar.fillRange = Math.max(0, p.hp / p.maxHp)   // 0~1

        if (p.hp <= 0) this.showGameOver()
    }

    // ==================== 五、对外接口 ====================

    /** 结算：写最高分、显示面板 */
    showGameOver(): void {
        this._over = true
        const sec = Math.floor(this._time)

        // 破纪录才写存档（StartPanel 内部判断）
        StartPanel.instance?.saveBest(sec)

        // 结算面板显示"本局"和"历史最高"的较大值
        const stored = Number(sys.localStorage.getItem('survival_best') ?? 0)
        const best = Math.max(sec, stored)

        if (this.resultLabel) {
            this.resultLabel.string = `存活 ${sec} 秒\n最高纪录 ${best} 秒\n击杀 ${Enemy.killed}`
        }
        if (this.gameOverPanel) this.gameOverPanel.active = true
    }

    // ==================== 六、输入回调 ====================

    private onKeyDown(e: EventKeyboard): void {
        // ESC：暂停 / 继续
        if (e.keyCode === KeyCode.ESCAPE) {
            if (!GameState.started || this._over) return   // 菜单和结算界面不响应
            GameState.paused = !GameState.paused
            if (this.pausePanel) this.pausePanel.active = GameState.paused
            return
        }

        // R：结算后重开
        if (!this._over) return
        if (e.keyCode === KeyCode.KEY_R) {
            director.loadScene('scenes')
        }
    }
}