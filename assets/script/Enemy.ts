import { _decorator, Component, Collider2D, Prefab, Animation, Vec3 } from 'cc';
import { getNode, putNode } from './pool';
import { Player } from './Player';
import { HitFx } from './HitFx';
import { AudioMgr } from './AudioMgr';
import { Dmgpopup } from './Dmgpopup';
import { GameState } from './GameState';
import { EnemyBullet } from './EnemyBullet';

const { ccclass, property } = _decorator;

/**
 * 敌人脚本（普通怪 / 远程怪 / Boss 共用一份）
 * 靠预制体上的参数区分行为：
 *   · 近战怪：meleeInterval = 0，靠撞玩家造成伤害
 *   · 远程怪：shootInterval > 0，进入射程后开枪
 *   · Boss  ：meleeInterval > 0，靠近后起手 → 播攻击动画 → 按 hitRadius 判定
 */
@ccclass('Enemy')
export class Enemy extends Component {

    // ==================== 一、可配置属性 ====================

    @property({ tooltip: '生命值' })
    hp: number = 2

    @property({ tooltip: '移动速度（像素/秒）' })
    speed: number = 100

    @property({ tooltip: '美术朝向偏移：图朝右 0、朝上 -90、朝左 180、朝下 90' })
    angleOffset: number = -90

    @property({ tooltip: '死亡掉几个经验球' })
    expCount: number = 1

    // ---- 动画 ----
    @property({ type: Animation, tooltip: '动画组件' })
    anim: Animation = null

    @property({ tooltip: '待机动画名（Animation 组件 Clips 列表里的名字）' })
    idleClip: string = 'bat'

    @property({ tooltip: '死亡动画名（Wrap Mode 必须是 Normal）' })
    deathClip: string = 'enemy-death'

    @property({ tooltip: '攻击动画名，留空则不播' })
    attackClip: string = ''

    // ---- 预制体 ----
    @property({ type: Prefab, tooltip: '经验球预制体' })
    expPrefab: Prefab = null

    @property({ type: Prefab, tooltip: '伤害飘字预制体' })
    dmgPrefab: Prefab = null

    // ---- 远程怪 ----
    @property({ tooltip: '开火间隔（秒），0 表示不开火' })
    shootInterval: number = 0

    @property({ type: Prefab, tooltip: '敌人子弹预制体（远程怪才填）' })
    bulletPrefab: Prefab = null

    @property({ tooltip: '射程：进入这个距离才开始开火' })
    fireRange: number = 600

    @property({ tooltip: '保持距离：小于这个距离就站住不动' })
    keepDistance: number = 500

    // ---- 近战怪 ----
    @property({ tooltip: '近战攻击间隔（秒），0 表示关闭' })
    meleeInterval: number = 0

    @property({ tooltip: '进入这个距离开始近战攻击' })
    meleeRange: number = 150

    @property({ tooltip: '出手判定范围：前摇结束时玩家还在圈内才算命中' })
    hitRadius: number = 170

    @property({ tooltip: '近战伤害' })
    meleeDamage: number = 2

    @property({ tooltip: '前摇秒数：播动画后多久真正造成伤害' })
    meleeWindup: number = 0.35

    // ==================== 二、静态数据 ====================

    /** 场上所有活着的敌人（玩家找最近目标用） */
    static all: Enemy[] = []

    /** 累计击杀数（HUD 显示用） */
    static killed: number = 0

    // ==================== 三、私有状态 ====================

    /** 当前血量（真正参与计算的数值，等于配置值 + 难度成长） */
    private _hp: number = 0

    /** 是否正在播死亡动画（尸体不再参与任何逻辑） */
    private _dead: boolean = false

    /** 指向玩家的单位向量，每帧复用，避免 new */
    private _dir: Vec3 = new Vec3(0, 0, 0)

    /** 开火倒计时 */
    private _fireTimer: number = 0

    /** 出手冷却 */
    private _atkTimer: number = 0

    /** 是否正在出招（前摇 → 判定 → 收招） */
    private _attacking: boolean = false

    /** 受击特效（onLoad 里自动挂载，不用改预制体） */
    private fx: HitFx = null

    // ==================== 四、生命周期 ====================

    protected onLoad(): void {
        // 没在编辑器里拖的话，自动取身上的 Animation 组件
        if (!this.anim) this.anim = this.getComponent(Animation)
        // 动画播完会发 FINISHED 事件，这里判断是不是死亡动画
        this.anim?.on(Animation.EventType.FINISHED, this.onAnimFinished, this)

        // 受击特效：预制体上没挂就自动加一个
        this.fx = this.getComponent(HitFx)
        if (!this.fx) this.fx = this.addComponent(HitFx)
    }

    /** 从对象池捞出来时也会触发：这里做完整的"复活"复位 */
    protected onEnable(): void {
        Enemy.all.push(this)

        // 血量 = 配置值 + 难度成长（每 45 秒 +1 点）
        this._hp = this.hp + Math.floor(GameState.time / 45)
        this._dead = false

        // 清掉上一轮没跑完的定时器（死亡回收、出招判定）
        this.unscheduleAllCallbacks()
        this._atkTimer = 0
        this._attacking = false

        // 随机错开首次开火时间，避免一群远程怪同一瞬间齐射
        if (this.shootInterval > 0) this._fireTimer = this.shootInterval * Math.random()

        // 碰撞体在死亡时被关掉过，这里重新打开
        const col = this.getComponent(Collider2D)
        if (col) col.enabled = true

        // 复活后先播待机动画
        this.anim?.play(this.idleClip)
    }

    /** 被 putNode 回收时触发 */
    protected onDisable(): void {
        const i = Enemy.all.indexOf(this)
        if (i >= 0) Enemy.all.splice(i, 1)
        // 回池时把闪色 / 缩放 / 击退清干净，否则下次复用会带脏状态
        this.fx?.stop()
    }

    // ==================== 五、每帧逻辑 ====================

    update(dt: number): void {
        if (!GameState.started) return   // 还在开始界面
        if (GameState.paused) return     // 暂停中
        if (GameState.over) return       // 游戏已结束
        if (this._dead) return           // 死亡动画播放中

        const player = Player.instance
        if (!player || !player.node || !player.node.isValid) return

        // 方向 = 玩家位置 - 自己位置
        Vec3.subtract(this._dir, player.node.position, this.node.position)

        const dist = this._dir.length()   // 像素距离，必须在归一化之前取
        this._dir.normalize()             // 归一化成单位向量

        // 面朝玩家：atan2 得到弧度，乘 57.3 转成角度，再加美术朝向偏移
        this.node.angle = Math.atan2(this._dir.y, this._dir.x) * 57.3 + this.angleOffset

        // ---- 近战分支（meleeInterval 为 0 的普通怪整段跳过）----
        if (this.meleeInterval > 0) {
            if (this._atkTimer > 0) this._atkTimer -= dt

            // 正在出招：不管玩家跑到哪，都先把这一招打完
            if (this._attacking) return

            if (dist <= this.meleeRange) {
                if (this._atkTimer <= 0) this.startMelee()
                return   // 出招期间站住不动，别一直往玩家身上挤
            }
        }

        // ---- 远程分支（shootInterval 为 0 的近战怪跳过）----
        if (this.shootInterval > 0) {
            // 只有进入射程才开始倒计时，屏幕外的敌人不开火
            if (dist <= this.fireRange) {
                this._fireTimer -= dt
                if (this._fireTimer <= 0) {
                    this.fire()
                    this._fireTimer = this.shootInterval
                }
            }
            // 到达保持距离：站住，继续朝玩家射击
            if (dist <= this.keepDistance) return
        }

        // ---- 移动：新位置 = 旧位置 + 方向 × 速度 × 这一帧的秒数 ----
        const pos = this.node.position
        this.node.setPosition(
            pos.x + this._dir.x * this.speed * dt,
            pos.y + this._dir.y * this.speed * dt,
            pos.z
        )
    }

    // ==================== 六、对外接口 ====================

    /**
     * 受到伤害
     * @param n   扣多少血
     * @param dir 可选：子弹飞来的方向，传给受击特效做击退
     */
    takeDamage(n: number, dir?: Vec3): void {
        if (this._dead) return    // 尸体不再掉血
        if (GameState.over) return

        this._hp -= n

        // 飘字：与敌人挂同一层父节点（同层才能直接用敌人的坐标），弹在头顶上方
        if (this.dmgPrefab) {
            const p = getNode(this.dmgPrefab)
            p.setParent(this.node.parent)
            p.getComponent(Dmgpopup)?.init(n, this.node.position.x, this.node.position.y + 40)
        }

        if (this._hp <= 0) {
            this.die()
            return
        }
        // 还活着 → 播受击特效
        this.fx?.play(dir)
    }

    // ==================== 七、内部逻辑 ====================

    /** 朝玩家开一枪 */
    private fire(): void {
        // 没配子弹预制体就不开枪（近战怪走这里）
        if (!this.bulletPrefab) return

        const b = getNode(this.bulletPrefab)
        b.setParent(this.node.parent)          // 挂到同一层，保证坐标系一致
        b.setWorldPosition(this.node.worldPosition)   // 从敌人当前位置出生
        b.getComponent(EnemyBullet)?.setDirection(this._dir)   // 把方向告诉子弹
    }

    /** 近战起手：播攻击动画，前摇结束后判定伤害 */
    private startMelee(): void {
        this._attacking = true
        this._atkTimer = this.meleeInterval

        if (this.attackClip && this.anim) this.anim.play(this.attackClip)
        this.scheduleOnce(this.doMeleeHit, this.meleeWindup)              // 前摇结束 → 判定
        this.scheduleOnce(this.endMelee, this.meleeWindup + 0.3)          // 再等 0.3 秒 → 收招
    }

    /** 出手判定：这一刻玩家还在圈内才算打中（躲开就落空） */
    private doMeleeHit(): void {
        if (this._dead) return
        if (GameState.over) return        // 玩家已死 / 游戏结束，不再补刀

        const p = Player.instance
        if (!p || !p.node || !p.node.isValid) return

        // 用平方距离比较，省一次开方
        const dx = p.node.position.x - this.node.position.x
        const dy = p.node.position.y - this.node.position.y
        if (dx * dx + dy * dy <= this.hitRadius * this.hitRadius) {
            p.takeDamage(this.meleeDamage)
        }
    }

    /** 收招：解除出招状态，切回待机动画 */
    private endMelee(): void {
        this._attacking = false
        if (!this._dead && this.anim && this.idleClip) this.anim.play(this.idleClip)
    }

    /** 死亡：掉经验、记击杀、播死亡动画、回收 */
    private die(): void {
        if (this._dead) return
        this._dead = true
        Enemy.killed++
        this.fx?.stop()   // 先收掉受击特效，免得红色剪影盖在尸体动画上

        // 掉经验球：只有掉多个时才沿圆周散开，掉 1 个就落在尸体位置
        if (this.expPrefab) {
            for (let i = 0; i < this.expCount; i++) {
                const orb = getNode(this.expPrefab)
                this.node.parent.addChild(orb)

                const off = this.expCount > 1 ? 40 : 0
                const a = Math.PI * 2 * i / this.expCount
                orb.setPosition(
                    this.node.position.x + Math.cos(a) * off,
                    this.node.position.y + Math.sin(a) * off,
                    this.node.position.z
                )
            }
        }

        // 尸体不再参与"最近的敌人"和"子弹命中"，否则玩家会对着尸体打
        const i = Enemy.all.indexOf(this)
        if (i >= 0) Enemy.all.splice(i, 1)

        this.anim?.play(this.deathClip)

        // 尸体不该再撞人：延迟一帧关碰撞体，避免在物理回调里改刚体触发引擎警告
        this.scheduleOnce(() => {
            const col = this.getComponent(Collider2D)
            if (col) col.enabled = false
        }, 0)

        AudioMgr.instance?.playEnemyDie()

        // 兜底：动画组件缺失或动画播不完时，0.6 秒后强制回收
        this.scheduleOnce(() => putNode(this.node), 0.6)
    }

    /** 动画播放结束：只有"死亡中"才回池，待机动画结束不该回池 */
    private onAnimFinished(): void {
        if (this._dead) putNode(this.node)
    }
}