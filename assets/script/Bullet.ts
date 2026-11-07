import { _decorator, Component, Vec3 } from 'cc';
import { putNode } from './pool';
import { Enemy } from './Enemy';
import { GameState } from './GameState';
const { ccclass, property } = _decorator;

@ccclass('Bullet')
export class Bullet extends Component {
    @property({ tooltip: '子弹飞行速度' })
    speed: number = 800
    @property({ tooltip: '命中判定半径' })
    hitRadius: number = 26

    @property({ tooltip: '伤害' })
    damage: number = 1
    // 飞行方向，单位向量
    private _dir = new Vec3(0, 1, 0)

    //告诉子弹往哪里飞
    public setDirection(dir: Vec3): void {
        this._dir.set(dir.x, dir.y, dir.z)
        this._dir.normalize()
        this.node.angle = Math.atan2(this._dir.y, this._dir.x) * 57.3
    }
    update(dt: number) {
        if (GameState.over) return       // 游戏结束，子弹停飞
        // 1. 先往前走
        const pos = this.node.position
        this.node.setPosition(
            pos.x + this._dir.x * this.speed * dt,
            pos.y + this._dir.y * this.speed * dt,
            pos.z
        )
      // 2. 检查有没有打中敌人
        const r2 = this.hitRadius * this.hitRadius   // 半径平方，省开根号
        for (const e of Enemy.all) {
            const dx = e.node.position.x - this.node.position.x
            const dy = e.node.position.y - this.node.position.y
            if (dx * dx + dy * dy <= r2) {
                 // 扣血（里面会判断死没死），顺便把飞行方向传过去当击退方向
                e.takeDamage(this.damage, this._dir)  
                 // 打中了，子弹消失
                putNode(this.node)         
                return                      
            }
        }

        // 3. 飞出地图就回收（地图半边长 2000，留 300 余量）
        if (Math.abs(this.node.position.x) > 2300 || Math.abs(this.node.position.y) > 2300) {
            putNode(this.node)
        }
    }
    
    
    
    }



    


