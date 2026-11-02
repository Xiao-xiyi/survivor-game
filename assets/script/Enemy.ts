import { _decorator, Component, Node, Animation, Vec3 } from 'cc';
import { putNode } from './pool';
const { ccclass, property } = _decorator;
// 引入 Player，用来读玩家位置
import { Player } from './Player';

@ccclass('Enemy')
export class Enemy extends Component {
    @property({ type: Animation, tooltip: '动画组件' })
    anim: Animation = null
     @property({ tooltip: '待机动画名（Clips 列表里的名字）' })
    idleClip: string = 'bat'
    @property({ tooltip: '死亡动画名' })
    deathClip: string = 'enemy-death'
    // 是否处于"正在播死亡动画"的状态
    private _dead = false
    @property({ tooltip: '移动速度（像素/秒）' })
    speed: number = 100;
    // 所有活着的敌人名单，静态的，全项目共享一份
    static all: Enemy[] = []
    @property({ tooltip: '生命值' })
    hp: number = 2
    // 当前血量（真正的运行时数值）
    private _hp: number = 0
    // 节点显示时触发（从池里捞出来时也会触发）
    protected onEnable(): void {
         // ⚠️ 从池里捞出来的节点，血必须重置
        Enemy.all.push(this)     // 加入名单
        this._hp = this.hp
        this._dead = false       // ⚠️ 死亡标记也要重置
        this.anim?.play(this.idleClip)   // 复活后先播待机      
    }
    // 节点隐藏时触发（被 putNode 回收时也会触发）
    protected onDisable(): void {
        const i = Enemy.all.indexOf(this)   // 找不到返回 -1
        if (i >= 0) Enemy.all.splice(i, 1)  // 找到了就从名单里删掉
    }
    private _dir = new Vec3(0, 0, 0);


    private die(): void {
        // 已经死了，别重复触发
        if (this._dead) return
        this._dead = true
        // 尸体不再参与"最近的敌人"和"子弹命中"，否则玩家会对着尸体打
        const i = Enemy.all.indexOf(this)
        if (i >= 0) Enemy.all.splice(i, 1)

        // 播死亡动画，播完由 onAnimFinished 回池
        this.anim?.play(this.deathClip)
    }

    takeDamage(n: number): void {
        if (this._dead) return   // 尸体不再掉血
        this._hp -= n
        if (this._hp <= 0) this.die()
    }

    update(dt: number) {
           if (this._dead) return   // 死亡动画播放期间不再追玩家
        const player = Player.instance
        if (!player || !player.node || !player.node.isValid) return;
        // 算出从自己指向玩家的方向：目标位置 - 自己的位置
        // 参数顺序：输出对象、起点、终点
        Vec3.subtract(this._dir, player.node.position, this.node.position,)

        //归一化
        this._dir.normalize();
        //atan2算出弧度，*57.3 转成角度，-90
        this.node.angle = Math.atan2(this._dir.y, this._dir.x) * 57.3 - 90;
        const pos = this.node.position
        // 新位置 = 旧位置 + 方向 × 速度 × 这一帧的秒数
        this.node.setPosition(
            pos.x + this._dir.x * this.speed * dt,
            pos.y + this._dir.y * this.speed * dt,
            pos.z
        )
    }
    protected onLoad(): void {
        // 没在编辑器里拖的话，自动取身上的 Animation 组件
        if (!this.anim) this.anim = this.getComponent(Animation)
        // 动画播完会发这个事件，我们在里面判断是不是死亡动画
        this.anim?.on(Animation.EventType.FINISHED, this.onAnimFinished, this)
    }

    // 动画播放结束
    private onAnimFinished(): void {
        // 只有"死亡中"才回池。待机动画结束不该回池
        if (this._dead) putNode(this.node)
    }
}

