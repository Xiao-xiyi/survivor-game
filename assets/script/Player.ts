import { _decorator, Component, EventKeyboard, Input, input, KeyCode, Node, Vec3, math, Collider2D, Contact2DType } from 'cc';
const { ccclass, property } = _decorator;
import { putNode } from './pool';

@ccclass('Player')
export class Player extends Component {
    // 本帧碰到玩家的敌人，先攒着，等这一帧物理算完再回收
    private _pending: Node[] = []
    @property({ tooltip: '玩家血量' })
    hp: number = 5
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
            case KeyCode.KEY_W: this._dir.y = 1; break
            case KeyCode.KEY_S: this._dir.y = -1; break
            case KeyCode.KEY_A: this._dir.x = -1; break
            case KeyCode.KEY_D: this._dir.x = 1; break

        }

    }
    // 松开键盘时触发
    onKeyup(e: EventKeyboard) {
        switch (e.keyCode) {
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

        // 把自己存进静态变量
        Player.instance = this;
        //获取碰撞体
        const col = this.getComponent(Collider2D)
        if (col) {
            col.on(Contact2DType.BEGIN_CONTACT, this.onHitByEnemy, this)

        }
        input.on(Input.EventType.KEY_DOWN, this.onKeydown, this)
        input.on(Input.EventType.KEY_UP, this.onKeyup, this)
    }
    // onDestroy：节点被销毁时调用一次
    protected onDestroy(): void {
        // 销毁时清掉，避免野指针
        if (Player.instance === this) Player.instance = null;
        input.off(Input.EventType.KEY_DOWN, this.onKeydown, this)
        input.off(Input.EventType.KEY_UP, this.onKeyup, this)
    }



    start() {

    }

    update(dt: number) {

        //下一帧回收
        if (this._pending.length > 0) {
            for (const n of this._pending) putNode(n)
            this._pending.length = 0
        }
        if (this._dir.lengthSqr() === 0) return
        //归一化/
        const d = this._dir.normalize()
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
        if (this._invincibleTicker > 0)
            this._invincibleTicker -= dt;  // 时间递减
    }

    takeDamage(dmg: number = 1): void {
        //无敌真没结束就不掉血
        if (this._invincibleTicker > 0) return
        this.hp -= dmg
        console.log(this.hp);

        if (this.hp <= 0) {
            this.die()
            return
        }

        //触发无敌帧
        this._invincibleTicker = this.invincibleTime;
    }

    die() {
        console.log('玩家死亡');
        this.node.active = false;

    }




}


