import { _decorator, Component, Node, Vec3 } from 'cc';
import { putNode } from './pool';
const { ccclass, property } = _decorator;
// 引入 Player，用来读玩家位置
import { Player } from './Player';

@ccclass('Enemy')
export class Enemy extends Component {
    @property({ tooltip: '移动速度（像素/秒）' })
    speed: number = 100;
    private _dir = new Vec3(0, 0, 0);

    update(dt: number) {
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
}

