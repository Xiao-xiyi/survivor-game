import {
    _decorator, Component, Prefab, EventKeyboard, Animation, Input, input,
    KeyCode, Node, Vec3, math, Collider2D, Contact2DType, Camera, view
} from 'cc';
import { getNode, putNode } from './pool';
import { UpgradePanel } from './UpgradePanel';
import { Bullet } from './Bullet';
import { Enemy } from './Enemy';
import { GameState } from './GameState';
import { AudioMgr } from './AudioMgr';

const { ccclass, property } = _decorator;

/**
 * 玩家脚本
 * 职责：读键盘 → 移动 / 自动瞄准最近敌人 → 开火；受伤与死亡；升级。
 */
@ccclass('Player')
export class Player extends Component {

    // ==================== 一、可配置属性 ====================

    @property({ type: Camera, tooltip: '主相机，用来算可视范围（不拖就用兜底值 750）' })
    cam: Camera = null

    @property({ tooltip: '移动速度（像素/秒）' })
    speed: number = 300

    @property({ type: Prefab, tooltip: '子弹预制体' })
    bulletPrefab: Prefab = null

    @property({ tooltip: '射击间隔（秒）' })
    fireInterval: number = 0.3

    @property({ tooltip: '基础伤害' })
    baseDamage: number = 1

    @property({ tooltip: '额外伤害（升级加成）' })
    damageBonus: number = 0

    // ---- 动画 ----
    @property({ type: Animation, tooltip: '走路帧动画（同时管射击 / 死亡动画）' })
    walkAnim: Animation = null

    // ---- 数值 ----
    @property({ tooltip: '等级' })
    level: number = 1

    @property({ tooltip: '当前经验' })
    exp: number = 0

    @property({ tooltip: '升到下一级需要的经验' })
    expNeed: number = 5

    @property({ tooltip: '玩家血量' })
    hp: number = 5

    @property({ tooltip: '最大血量' })
    maxHp: number = 5

    @property({ tooltip: '无敌帧时长（秒）' })
    invincibleTime: number = 1

    @property({ tooltip: '无敌帧倒计时' })
    private _invincibleTicker: number = 0

    // ==================== 二、静态实例 ====================

    /** 玩家单例：别的脚本用 Player.instance 就能拿到玩家，不用 find() */
    static instance: Player = null

    // ==================== 三、私有状态 ====================

    /** 射击冷却剩余时间 */
    private _cooldown: number = 0

    /** 是否正在按住开火键 */
    private _firing: boolean = false

    /** 是否已经死了（死了不再响应输入、不再移动） */
    private _dying: boolean = false

    /** 上一帧是不是在走，用来判断"状态有没有变化" */
    private _walking: boolean = false

    /** 本帧撞到玩家的敌人，先攒着，等这一帧物理算完再统一回收 */
    private _pending: Node[] = []

    /** 输入方向（-1 / 0 / 1） */
    private _dir: Vec3 = new Vec3(0, 0, 0)

    /** 自动瞄准的最大距离，onLoad 里按屏幕算一次 */
    private _aimRange: number = 750

    // ==================== 四、生命周期 ====================

    protected onLoad(): void {
        // 算自动瞄准范围：屏幕中心到四个角的距离
        if (this.cam) {
            const halfH = this.cam.orthoHeight                       // 360（世界单位）
            const size = view.getVisibleSize()                       // 实际窗口像素
            const halfW = halfH * size.width / size.height           // 按窗口比例算半宽
            this._aimRange = Math.sqrt(halfH * halfH + halfW * halfW)
        }

        Player.instance = this

        // 碰撞：敌人撞到我
        const col = this.getComponent(Collider2D)
        if (col) col.on(Contact2DType.BEGIN_CONTACT, this.onHitByEnemy, this)

        // 键盘
        input.on(Input.EventType.KEY_DOWN, this.onKeydown, this)
        input.on(Input.EventType.KEY_UP, this.onKeyup, this)

        // 动画播完（射击 / 死亡）切回对应状态
        this.walkAnim?.on(Animation.EventType.FINISHED, this.onAnimFinished, this)
    }

    protected onDestroy(): void {
        if (Player.instance === this) Player.instance = null
        input.off(Input.EventType.KEY_DOWN, this.onKeydown, this)
        input.off(Input.EventType.KEY_UP, this.onKeyup, this)
        this.walkAnim?.off(Animation.EventType.FINISHED, this.onAnimFinished, this)  // 与 onLoad 里的 on 成对
    }

    // ==================== 五、每帧逻辑 ====================

    update(dt: number): void {
        if (!GameState.started) return   // 还在开始界面
        if (GameState.paused) return     // 暂停中

        // 先回收"上一帧撞到我"的敌人。必须放在 _dying 判断之前，
        // 否则玩家死亡那一瞬间撞上来的敌人会永远留在场上
        if (this._pending.length > 0) {
            for (const n of this._pending) putNode(n)
            this._pending.length = 0
        }

        if (this._dying) return

        // 无敌帧倒计时：必须放在下面"站着不动就 return"之前，否则站着时会永久无敌
        if (this._invincibleTicker > 0) this._invincibleTicker -= dt

        // 冷却是"规则时钟"，不管按没按键时间都在走
        if (this._cooldown > 0) this._cooldown -= dt

        // ---- 开火 ----
        if (this._firing && this._cooldown <= 0) {
            if (this.fire()) this._cooldown = this.fireInterval
        }

        // ---- 开火时，身体朝最近的敌人 ----
        if (this._firing) {
            const t = this.findNearestEnemy()
            if (t) {
                const dx = t.node.position.x - this.node.position.x
                const dy = t.node.position.y - this.node.position.y
                this.node.angle = Math.atan2(dy, dx) * 57.3
            }
        }

        // ---- 移动 ----
        if (this._dir.lengthSqr() === 0) {
            // 从"走"变成"停"：只在变化的那一刻停一次
            if (this._walking) {
                this._walking = false
                this.walkAnim?.stop()
            }
            return
        }

        // 从"停"变成"走"：只在起步那一刻播一次
        if (!this._walking) {
            this._walking = true
            this.walkAnim?.play()
        }

        const d = this._dir.normalize()

        // 没开火时才跟移动方向转（开火时朝敌人）
        if (!this._firing) {
            this.node.angle = Math.atan2(d.y, d.x) * 57.3
        }

        const pos = this.node.position
        this.node.setPosition(
            pos.x + d.x * this.speed * dt,
            pos.y + d.y * this.speed * dt,
            pos.z
        )

        // 限制在地图范围内（地图半边 2000）
        const halfMap = 2000
        const px = math.clamp(this.node.position.x, -halfMap, halfMap)
        const py = math.clamp(this.node.position.y, -halfMap, halfMap)
        this.node.setPosition(px, py, this.node.position.z)
    }

    // ==================== 六、对外接口 ====================

    /** 受伤：有伤害值，也有无敌帧保护 */
    takeDamage(dmg: number = 1): void {
        if (this._dying) return                  // 已经死了就别再扣血
        if (this._invincibleTicker > 0) return   // 无敌帧没结束

        this.hp -= dmg
        AudioMgr.instance?.playHurt()

        if (this.hp <= 0) {
            this.die()
            return
        }
        this._invincibleTicker = this.invincibleTime   // 触发无敌帧
    }

    /** 死亡：停 BGM、播死亡动画、0.6 秒后隐藏自己是 */
    die(): void {
        if (this._dying) return
        this._dying = true
        GameState.over = true
        AudioMgr.instance?.stopBgm()
        this.walkAnim?.play('player-death')
        // 等死亡动画播完再隐藏（直接 active=false 会看不到动画）
        this.scheduleOnce(() => { this.node.active = false }, 0.6)
    }

    /** 加经验：够了就升级，可能一次连升多级 */
    gainExp(n: number): void {
        this.exp += n
        while (this.exp >= this.expNeed) {
            this.exp -= this.expNeed        // 扣掉这一级要的量
            this.level++                    // 等级 +1
            this.expNeed = Math.ceil(this.expNeed * 1.4)   // 下一级门槛变高 40%
            this.onLevelUp()
        }
    }

    /** 升级：弹三选一面板 */
    onLevelUp(): void {
        UpgradePanel.instance?.show()
    }

    // ==================== 七、内部逻辑 ====================

    /** 开一枪：朝最近的敌人；成功返回 true */
    private fire(): boolean {
        if (!this.bulletPrefab) return false

        const target = this.findNearestEnemy()
        if (!target) return false            // 场上没敌人就不开火

        // 方向 = 敌人位置 - 自己位置
        const dir = new Vec3(0, 0, 0)
        Vec3.subtract(dir, target.node.position, this.node.position)
        dir.normalize()

        const bullet = getNode(this.bulletPrefab)
        this.node.parent.addChild(bullet)
        // 沿发射方向挪 60 像素出生，避免子弹和玩家重叠
        bullet.setPosition(
            this.node.position.x + dir.x * 60,
            this.node.position.y + dir.y * 60,
            this.node.position.z
        )

        const b = bullet.getComponent(Bullet)
        b.setDirection(dir)
        b.damage = this.baseDamage + this.damageBonus

        this.walkAnim?.play('player-shoot')
        AudioMgr.instance?.playShoot()       // 真开火了才响
        return true
    }

    /** 找离自己最近的敌人（只在瞄准范围内找），没有就返回 null */
    private findNearestEnemy(): Enemy {
        const MAX_RANGE = this._aimRange
        let best: Enemy = null
        let bestDist = MAX_RANGE * MAX_RANGE      // 用平方距离比较，省一次开方

        for (const e of Enemy.all) {
            const dx = e.node.position.x - this.node.position.x
            const dy = e.node.position.y - this.node.position.y
            const d = dx * dx + dy * dy
            if (d < bestDist) {
                bestDist = d
                best = e
            }
        }
        return best
    }

    /** 动画播完（射击动画结束）：在走就播走路，停下就停住 */
    private onAnimFinished(): void {
        if (this._walking) {
            this.walkAnim?.play('player-move')
        } else {
            this.walkAnim?.stop()
        }
    }

    // ==================== 八、输入与碰撞回调 ====================

    /** 按下键盘 */
    private onKeydown(e: EventKeyboard): void {
        switch (e.keyCode) {
            case KeyCode.KEY_J:
                if (!this._firing) this._firing = true
                break
            case KeyCode.KEY_W: this._dir.y = 1; break
            case KeyCode.KEY_S: this._dir.y = -1; break
            case KeyCode.KEY_A: this._dir.x = -1; break
            case KeyCode.KEY_D: this._dir.x = 1; break
        }
    }

    /** 松开键盘 */
    private onKeyup(e: EventKeyboard): void {
        switch (e.keyCode) {
            case KeyCode.KEY_J: this._firing = false; break
            case KeyCode.KEY_W:
            case KeyCode.KEY_S: this._dir.y = 0; break
            case KeyCode.KEY_A:
            case KeyCode.KEY_D: this._dir.x = 0; break
        }
    }

    /** 敌人撞到我：扣血，并把那个敌人排进回收队列（不在这里直接回收） */
    private onHitByEnemy(selfCol: Collider2D, otherCol: Collider2D): void {
        this.takeDamage(1)
        this._pending.push(otherCol.node)   // 只排队，不 putNode
    }
}