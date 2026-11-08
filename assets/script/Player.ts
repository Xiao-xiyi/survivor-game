import { _decorator, Component, Prefab, EventKeyboard, Animation, Input, input, KeyCode, Node, Vec3, math, Collider2D, Contact2DType, Camera, view } from 'cc';
const { ccclass, property } = _decorator;
import { getNode, putNode } from './pool';
import { UpgradePanel } from './UpgradePanel';
import { Bullet } from './Bullet';
import { Enemy } from './Enemy';
import { GameState } from './GameState';
import { AudioMgr } from './AudioMgr';

@ccclass('Player')
export class Player extends Component {
    @property({ type: Camera, tooltip: '主相机，用来算可视范围' })
    cam: Camera = null
    private _aimRange = 750    // onLoad 里算一次存起来，别每帧开根号


    @property({ tooltip: '等级' })
    level: number = 1
    @property({ tooltip: '当前经验' })
    exp: number = 0
    @property({ tooltip: '升到下一级需要的经验' })
    expNeed: number = 5

    @property({ type: Prefab, tooltip: '子弹预制体' })
    bulletPrefab: Prefab = null
    @property({ tooltip: '射击间隔（秒）' })
    fireInterval: number = 0.3


    @property({ tooltip: '基础伤害' })
    baseDamage: number = 1
    @property({ tooltip: '额外伤害（升级加成）' })
    damageBonus: number = 0


    // 射击计时器
    private _cooldown: number = 0
    // 是否正在按住开火键
    private _firing = false
    @property({ type: Animation, tooltip: '走路帧动画' })
    walkAnim: Animation = null
    // 是否已经死了（死了不再响应输入、不再移动）
    private _dying: boolean = false
    // 记录上一帧是不是在走，用来判断"状态有没有变化"
    private _walking: boolean = false
    // 本帧碰到玩家的敌人，先攒着，等这一帧物理算完再回收



    private _pending: Node[] = []
    @property({ tooltip: '玩家血量' })
    hp: number = 5
    @property({ tooltip: '最大血量' })
    maxHp: number = 5
    @property({ tooltip: '无敌帧时长' })
    invincibleTime: number = 1
    @property({ tooltip: '无敌帧倒计时' })
    private _invincibleTicker: number = 0
    //静态实例：别的脚本可以通过player.instance就能访问玩家
    static instance: Player = null
    @property({ tooltip: '移动速度' })
    speed: number = 300
    private _dir = new Vec3(0, 0, 0)
    // 按下键盘时触发，e.keyCode 是按键编号
    onKeydown(e: EventKeyboard) {
        switch (e.keyCode) {
            case KeyCode.KEY_J:
                if (!this._firing) {
                    this._firing = true
                } break

            case KeyCode.KEY_W: this._dir.y = 1; break
            case KeyCode.KEY_S: this._dir.y = -1; break
            case KeyCode.KEY_A: this._dir.x = -1; break
            case KeyCode.KEY_D: this._dir.x = 1; break

        }

    }
    // 松开键盘时触发
    onKeyup(e: EventKeyboard) {
        switch (e.keyCode) {
            case KeyCode.KEY_J: this._firing = false; break
            case KeyCode.KEY_W:
            case KeyCode.KEY_S: this._dir.y = 0; break
            case KeyCode.KEY_A:
            case KeyCode.KEY_D: this._dir.x = 0; break

        }

    }

    onHitByEnemy(selfCol: Collider2D, otherCol: Collider2D) {
        this.takeDamage(1)
        // 只排队，不 putNode
        this._pending.push(otherCol.node)

    }
    // onLoad：节点加载完成时调用一次，用来做初始化
    protected onLoad(): void {
        if (this.cam) {
            const halfH = this.cam.orthoHeight                          // 360
            const size = view.getVisibleSize()                          // 实际窗口
            const halfW = halfH * size.width / size.height              // 按窗口比例算半宽
            this._aimRange = Math.sqrt(halfH * halfH + halfW * halfW)   // 到屏幕角落的距离
        }
        // cam 没拖的话沿用兜底值 750


        // 把自己存进静态变量
        Player.instance = this;
        //获取碰撞体
        const col = this.getComponent(Collider2D)
        if (col) {
            col.on(Contact2DType.BEGIN_CONTACT, this.onHitByEnemy, this)

        }
        input.on(Input.EventType.KEY_DOWN, this.onKeydown, this)
        input.on(Input.EventType.KEY_UP, this.onKeyup, this)
        this.walkAnim?.on(Animation.EventType.FINISHED, this.onAnimFinished, this)
    }
    // onDestroy：节点被销毁时调用一次
    protected onDestroy(): void {
        // 销毁时清掉，避免野指针
        if (Player.instance === this) Player.instance = null;
        input.off(Input.EventType.KEY_DOWN, this.onKeydown, this)
        input.off(Input.EventType.KEY_UP, this.onKeyup, this)
        this.walkAnim?.off(Animation.EventType.FINISHED, this.onAnimFinished, this)  // 与 onLoad 里的 on 成对
    }
    private onAnimFinished(): void {
        if (this._walking) {
            this.walkAnim?.play('player-move')
        } else {
            this.walkAnim?.stop()
        }
    }

    private fire(): boolean {
        if (!this.bulletPrefab) return false

        const target = this.findNearestEnemy()
        if (!target) return false                     // 场上没敌人就不开火

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
        AudioMgr.instance?.playShoot()     // 真开火了才响
        return true
    }

    // 找离自己最近的敌人，没有就返回 null
    private findNearestEnemy(): Enemy {
        const MAX_RANGE = this._aimRange
        let best: Enemy = null
        let bestDist = MAX_RANGE * MAX_RANGE
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




    start() {

    }

    update(dt: number) {
        if (!GameState.started) return  
        if (this._dying) return

        if (this._invincibleTicker > 0)
            this._invincibleTicker -= dt;  // 时间递减

        //下一帧回收
        if (this._pending.length > 0) {
            for (const n of this._pending) putNode(n)
            this._pending.length = 0
        }
        // 冷却是"规则的时钟"，不管按没按键，时间都在走
        if (this._cooldown > 0) this._cooldown -= dt

        // 满足两个条件才能开火：想开火 + 冷却好了
        if (this._firing && this._cooldown <= 0) {
            if (this.fire()) {
                this._cooldown = this.fireInterval
            }
        }
        if (this._firing) {
            const t = this.findNearestEnemy()
            if (t) {
                const dx = t.node.position.x - this.node.position.x
                const dy = t.node.position.y - this.node.position.y
                this.node.angle = Math.atan2(dy, dx) * 57.3
            }
        }



        if (this._dir.lengthSqr() === 0) {
            // 从"走"变成"停"：只在变化的那一刻停一次
            if (this._walking) {
                this._walking = false
                this.walkAnim?.stop()
            }
            return
        }
        // ② 正在走：只在起步那一刻播一次
        if (!this._walking) {
            this._walking = true
            this.walkAnim?.play()
        }
        //归一化/
        const d = this._dir.normalize()
        //角色头朝向（没开火时才跟移动方向转）
        if (!this._firing) {
            this.node.angle = Math.atan2(d.y, d.x) * 57.3
        }

        // 取当前节点位置
        const pos = this.node.position
        // 新位置=旧位置+方向*速度*这一帧的秒数
        this.node.setPosition(
            pos.x + d.x * this.speed * dt,
            pos.y + d.y * this.speed * dt,
            pos.z


        )
        //地图的一半
        const halfMap = 2000
        // Math.clamp(值, 最小值, 最大值)：把值限制在范围内
        const px = math.clamp(this.node.position.x, -halfMap, halfMap)
        const py = math.clamp(this.node.position.y, -halfMap, halfMap)
        this.node.setPosition(px, py, this.node.position.z);

    }
    gainExp(n: number) {
        this.exp += n
        while (this.exp >= this.expNeed) {
            // 扣掉这一级要的量
            this.exp -= this.expNeed
            // 等级 +1
            this.level++
            // 下一级门槛变高 40%
            this.expNeed = Math.ceil(this.expNeed * 1.4)
            this.onLevelUp()

        }
    }
    onLevelUp() {

        UpgradePanel.instance?.show()

    }

    takeDamage(dmg: number = 1): void {
        //无敌真没结束就不掉血
        if (this._invincibleTicker > 0) return
        this.hp -= dmg
        AudioMgr.instance?.playHurt()
        if (this.hp <= 0) {
            this.die()
            return
        }

        //触发无敌帧
        this._invincibleTicker = this.invincibleTime;
    }

    die() {
        if (this._dying) return
        this._dying = true
        GameState.over = true
         // 死亡时音乐停掉
        AudioMgr.instance?.stopBgm()   
        this.walkAnim?.play('player-death')
        this.scheduleOnce(() => { this.node.active = false }, 0.6)

    }




}


