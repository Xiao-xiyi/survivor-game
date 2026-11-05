import { _decorator, Color, Component, Graphics, Node, Sprite, tween, UITransform, UIOpacity, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 受击特效（不闪白）
 *
 * 做法：
 *  1. 在敌人身上叠一层「同款精灵图 + 橙红色」的剪影，用不透明度快速衰减 —— 效果是"闪红"而不是"闪白"。
 *     蜘蛛本体是很暗的 (10,10,16)，改 color 相乘根本看不出来，所以必须靠叠一层亮色剪影。
 *  2. 命中点炸一个像素风火花（Graphics 画出来的十字星，零素材依赖）。
 *  3. 身体瞬间放大一点点再回弹（受击顿挫感）。
 *  4. 顺着子弹方向轻微击退。
 *
 * 用法：挂在敌人节点上（和 Sprite 同一个节点），调 takeDamage 时调 play()。
 * 不挂也行 —— Enemy.ts 会在 onLoad 里自动 addComponent。
 */
const SPARK_PATTERN = [
    '....X....',
    '....X....',
    '..X.X.X..',
    '...XXX...',
    '.XXOOOXX.',
    '...XXX...',
    '..X.X.X..',
    '....X....',
    '....X....',
];

const CORE_COLOR = new Color(255, 246, 214, 255);

@ccclass('HitFx')
export class HitFx extends Component {
    @property({ tooltip: '闪色持续时间（秒）' })
    flashTime: number = 0.11
    @property({ type: Color, tooltip: '受击闪的颜色（橙红，别设成纯白）' })
    flashColor: Color = new Color(255, 92, 58, 255)
    @property({ tooltip: '闪色最大不透明度 0~255' })
    flashAlpha: number = 190
    @property({ tooltip: '受击瞬间放大的倍数，1 = 不放大' })
    punchScale: number = 1.2
    @property({ tooltip: '击退初速度（像素/秒），0 = 不击退' })
    knockback: number = 170
    @property({ tooltip: '是否生成打击火花' })
    sparkEnabled: boolean = true
    @property({ type: Color, tooltip: '火花颜色' })
    sparkColor: Color = new Color(255, 186, 78, 255)
    @property({ tooltip: '火花单个像素块的大小，0 = 根据敌人尺寸自动算' })
    sparkPixel: number = 0

    private _self: Sprite | null = null      // 自己身上的精灵（用来取当前帧）
    private _flash: Sprite | null = null     // 叠上去的红色剪影
    private _flashOp: UIOpacity | null = null
    private _t: number = 0
    private _playing: boolean = false
    private _knock: Vec3 = new Vec3()

    protected onLoad(): void {
        this._self = this.getComponent(Sprite)
    }

    protected onDisable(): void {
        this.stop()
    }

    /** 被打中的时候调它。dir 传子弹方向（可选），有的话会顺着方向击退 */
    public play(dir?: Vec3): void {
        if (!this._self) this._self = this.getComponent(Sprite)   // 兜底：组件是运行时加的，onLoad 可能还没跑
        if (!this._self || !this._self.spriteFrame) return

        // ---- 1. 闪红剪影 ----
        this._ensureFlash()
        if (this._flash && this._flashOp) {
            const put = this.node.getComponent(UITransform)
            const cut = this._flash.node.getComponent(UITransform)
            if (put && cut) {
                cut.setContentSize(put.contentSize)
                cut.setAnchorPoint(put.anchorPoint)
            }
            // 敌人的帧可能被动画换了，每次命中都同步一次，保证剪影和本体严丝合缝
            this._flash.spriteFrame = this._self.spriteFrame
            this._flash.color = this.flashColor
            this._flashOp.opacity = this.flashAlpha
            this._flash.node.active = true
        }

        // ---- 2. 计时器 ----
        this._t = 0
        this._playing = true

        // ---- 3. 击退 ----
        if (dir && this.knockback > 0) {
            this._knock.set(dir.x, dir.y, 0)
            if (this._knock.lengthSqr() > 0) {
                this._knock.normalize().multiplyScalar(this.knockback)
            }
        }

        // ---- 4. 火花 ----
        if (this.sparkEnabled) this._spawnSpark(dir)
    }

    /** 死亡 / 回收时把状态清干净 */
    public stop(): void {
        this._playing = false
        this._t = 0
        this._knock.set(0, 0, 0)
        if (this._flashOp) this._flashOp.opacity = 0
        if (this._flash && this._flash.node && this._flash.node.isValid) {
            this._flash.node.active = false
        }
        if (this.node && this.node.isValid) this.node.setScale(1, 1, 1)
    }

    update(dt: number): void {
        // 击退：直接叠加位移，Enemy 下一帧会从这个新位置继续追玩家
        if (this._knock.lengthSqr() > 1) {
            const p = this.node.position
            this.node.setPosition(p.x + this._knock.x * dt, p.y + this._knock.y * dt, p.z)
            this._knock.multiplyScalar(Math.exp(-dt * 13))   // 指数衰减，十几像素就停
        } else if (this._knock.lengthSqr() !== 0) {
            this._knock.set(0, 0, 0)
        }

        if (!this._playing) return
        this._t += dt
        const k = Math.min(1, this._t / Math.max(0.01, this.flashTime))

        // 前 25% 保持，后面快速褪掉 —— 看起来是"一下"，不是"慢慢淡"
        if (this._flashOp) {
            const a = k < 0.25 ? this.flashAlpha : this.flashAlpha * (1 - (k - 0.25) / 0.75)
            this._flashOp.opacity = a
        }
        // 放大后线性回弹
        const sc = 1 + (this.punchScale - 1) * (1 - k)
        this.node.setScale(sc, sc, 1)

        if (k >= 1) this.stop()
    }

    // ------------------------------------------------------------------

    private _ensureFlash(): void {
        if (this._flash && this._flash.node && this._flash.node.isValid) return
        const n = new Node('__hitFlash')
        n.layer = this.node.layer
        this.node.addChild(n)
        n.setPosition(0, 0, 0)
        n.addComponent(UITransform)
        const sp = n.addComponent(Sprite)
        sp.type = Sprite.Type.SIMPLE
        sp.sizeMode = Sprite.SizeMode.CUSTOM   // 尺寸完全跟随敌人本体，不随贴图变
        sp.color = this.flashColor
        const op = n.addComponent(UIOpacity)
        op.opacity = 0
        n.active = false
        this._flash = sp
        this._flashOp = op
    }

    private _spawnSpark(dir?: Vec3): void {
        const parent = this.node.parent
        if (!parent) return

        const selfUt = this.node.getComponent(UITransform)
        const baseW = selfUt ? selfUt.contentSize.width : 60

        const n = new Node('__hitSpark')
        n.layer = this.node.layer
        parent.addChild(n)
        // 钉在命中点（敌人中心往子弹来的方向偏一点），不跟着敌人跑
        const wp = this.node.worldPosition
        if (dir && (dir.x !== 0 || dir.y !== 0)) {
            const d = new Vec3(dir.x, dir.y, 0).normalize().multiplyScalar(-baseW * 0.22)
            n.setWorldPosition(wp.x + d.x, wp.y + d.y, wp.z)
        } else {
            n.setWorldPosition(wp)
        }

        const ut = n.addComponent(UITransform)
        ut.setContentSize(64, 64)
        const g = n.addComponent(Graphics)

        // 火花大小跟着敌人走，敌人多大火花就多大
        const s = this.sparkPixel > 0
            ? this.sparkPixel
            : Math.max(1, Math.min(8, Math.round(baseW / 28)))
        const rows = SPARK_PATTERN.length
        const cols = SPARK_PATTERN[0].length
        const cx = (cols - 1) / 2
        const cy = (rows - 1) / 2

        // 外圈
        g.fillColor = this.sparkColor
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (SPARK_PATTERN[r][c] === 'X') {
                    g.rect((c - cx) * s - s / 2, (cy - r) * s - s / 2, s, s)
                }
            }
        }
        g.fill()

        // 高亮核心
        g.fillColor = CORE_COLOR
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (SPARK_PATTERN[r][c] === 'O') {
                    g.rect((c - cx) * s - s / 2, (cy - r) * s - s / 2, s, s)
                }
            }
        }
        g.fill()

        const op = n.addComponent(UIOpacity)
        op.opacity = 255
        n.setScale(0.55, 0.55, 1)

        tween(n)
            .to(0.05, { scale: new Vec3(1.4, 1.4, 1) }, { easing: 'quadOut' })
            .to(0.09, { scale: new Vec3(2.2, 2.2, 1) }, { easing: 'quadIn' })
            .call(() => { if (n.isValid) n.destroy() })
            .start()
        tween(op).delay(0.03).to(0.11, { opacity: 0 }).start()
    }
}
