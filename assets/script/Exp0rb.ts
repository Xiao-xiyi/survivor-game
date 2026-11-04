import { _decorator, Component } from 'cc';
import { putNode } from './pool';
import { Player } from './Player';
const { ccclass, property } = _decorator;

@ccclass('ExpOrb')
export class ExpOrb extends Component {
    @property({ tooltip: '这颗球值多少经验' })
    value: number = 1
    @property({ tooltip: '进入这个半径就被吸过来' })
    attractRadius: number = 180
    @property({ tooltip: '被吸时的飞行速度（像素/秒）' })
    speed: number = 420
    protected update(dt: number): void {
        const p = Player.instance
        if (!p || !p.node.isValid) return
        const dx = p.node.position.x - this.node.position.x  // x 方向差
        const dy = p.node.position.y - this.node.position.y  // y 方向差

        // 离玩家不到 40 像素 → 判定为吃到
        const d2 = dx * dx + dy * dy
        if (d2 < 40 * 40) {
            // 给玩家加经验              
            p.gainExp(this.value)
            // 自己回对象池              
            putNode(this.node)
            return
        }
        // 太远 原地不动
        if (d2 > this.attractRadius * this.attractRadius) return
         const d = Math.sqrt(d2)
          // 朝玩家移动这一帧的位移                   
        this.node.setPosition(                   
            this.node.position.x + (dx / d) * this.speed * dt,  
            this.node.position.y + (dy / d) * this.speed * dt,
            this.node.position.z
        )
    }

}