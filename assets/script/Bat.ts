import { _decorator, Component, Node, Sprite, SpriteFrame, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 黑蝙蝠敌人：扇翅 + 直线追玩家
 * 用法：
 *   1. 场景里新建空节点，加 Sprite 组件，SpriteFrame 选 bat_fly_01
 *   2. 把本脚本挂上去
 *   3. frames 数组按顺序拖入 bat_fly_01 / 02 / 03
 *   4. target 拖 Player 节点
 */
@ccclass('Bat')
export class Bat extends Component {
    @property({ type: Node, tooltip: '追逐目标（玩家）' })
    target: Node = null

    @property({ tooltip: '移动速度（像素/秒）' })
    speed: number = 120

    @property({ type: [SpriteFrame], tooltip: '扇翅动画帧，按顺序拖入' })
    frames: SpriteFrame[] = []

    @property({ tooltip: '每帧持续秒数' })
    frameTime: number = 0.1

    private _sprite: Sprite = null
    private _t: number = 0
    private _idx: number = 0
    private _dir: Vec3 = new Vec3()

    onLoad() {
        this._sprite = this.getComponent(Sprite)
    }

    update(dt: number) {
        this._playFlap(dt)
        this._chase(dt)
    }

    private _playFlap(dt: number) {
        if (!this._sprite || this.frames.length < 2) return
        this._t += dt
        while (this._t >= this.frameTime) {
            this._t -= this.frameTime
            this._idx = (this._idx + 1) % this.frames.length
            this._sprite.spriteFrame = this.frames[this._idx]
        }
    }

    private _chase(dt: number) {
        if (!this.target || !this.target.isValid) return
        const p = this.target.worldPosition
        const c = this.node.worldPosition
        Vec3.subtract(this._dir, p, c)
        if (this._dir.lengthSqr() < 1) return
        this._dir.normalize()

        // 贴图默认朝上，往左飞时水平翻转
        const s = this.node.scale
        const sx = Math.abs(s.x)
        this.node.setScale(this._dir.x < 0 ? -sx : sx, s.y, s.z)

        this.node.setWorldPosition(
            c.x + this._dir.x * this.speed * dt,
            c.y + this._dir.y * this.speed * dt,
            c.z
        )
    }
}
