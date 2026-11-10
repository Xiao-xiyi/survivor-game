import { _decorator, Component, Node, Vec3 } from 'cc';
import { putNode } from './pool';
import { Player } from './Player';
import { GameState } from './GameState'
const { ccclass, property } = _decorator;

@ccclass('EnemyBullet')
export class EnemyBullet extends Component {
    @property({ tooltip: '飞行速度（像素/秒）' })
    speed: number = 320

    @property({ tooltip: '伤害值' })
    damage: number = 1

    @property({ tooltip: '命中判定半径，要能覆盖玩家身体' })
    hitRadius: number = 50

    private _dir = new Vec3(0, -1, 0)

    setDirection(dir: Vec3): void {
        // 把传进来的方向抄一份存起来（避免引用外部对象被别处改掉）
        this._dir.set(dir.x, dir.y, dir.z)
        // 归一化：长度变成 1，只保留方向
        this._dir.normalize()

        this.node.angle = Math.atan2(this._dir.y, this._dir.x) * 57.3
    }

    update(dt: number) {
        // 游戏暂停时不移动
        if (GameState.paused) return
        // 还在菜单界面（没按空格）时不移动
        if (!GameState.started) return
        // 玩家已死亡，残留子弹全部停下
        if (GameState.over) return

        // 先记下当前位置，下面用"当前位置 + 方向×速度×dt"算新位置
        const pos = this.node.position
        // 设置新位置
        this.node.setPosition(
            pos.x + this._dir.x * this.speed * dt,   // 横向位移
            pos.y + this._dir.y * this.speed * dt,   // 纵向位移
            pos.z                                    // 深度不变
        )

        // 取玩家单例
        const player = Player.instance
        // 玩家存在且节点有效才做命中判定
        if (player && player.node && player.node.isValid) {
            // 玩家与子弹的横向距离
            const dx = player.node.position.x - this.node.position.x
            // 玩家与子弹的纵向距离
            const dy = player.node.position.y - this.node.position.y
            // 判定半径
            const r = this.hitRadius
            // 用平方距离比较，省一次开根号（性能小技巧）
            if (dx * dx + dy * dy <= r * r) {
                // 打中玩家：扣血
                player.takeDamage(this.damage)
                // 子弹回收进对象池
                putNode(this.node)
                // 本帧处理完毕，直接返回
                return
            }
        }
        // 飞出地图边界就回收（地图半边 2000，留 300 余量）
        if (Math.abs(this.node.position.x) > 2300 || Math.abs(this.node.position.y) > 2300) {
            putNode(this.node)
        }


    }
}

