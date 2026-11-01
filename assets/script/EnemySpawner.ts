import { _decorator, Component, instantiate, math, Node, Prefab, Vec3 } from 'cc';
// 从 pool.ts 引入对象池的两个函数
import { getNode, putNode } from './pool';
const { ccclass, property } = _decorator;

@ccclass('NewComponent')
export class NewComponent extends Component {
    @property({ type: Prefab, tooltip: '敌人的预制体' })
    enemy: Prefab = null
    @property({ tooltip: '生成间隔' })
    spawnInterval: number = 1.2
    @property({ tooltip: '生成半径，要大于 2000 让敌人从屏幕外进来' })
    spawnRadius: number = 2100;
    private _timer: number = 0;
    private spawOne(): void {
        if (!this.enemy) return

        // 从对象池拿一个敌人节点（而不是 new）
        const enemy = getNode(this.enemy);
        //添加到父节点下面
        this.node.addChild(enemy)
        //随机生成一个角度
        const angleDeg = Math.random() * 360
        // 转换成弧度
        const angleRad = math.toRadian(angleDeg)
        // 在这个角度方向上、距离 spawnRadius 远的圆周上取一个点
        const x = Math.cos(angleRad) * this.spawnRadius;
        const y = Math.sin(angleRad) * this.spawnRadius;

        // 设置敌人的出生位置（世界坐标）
        enemy.setWorldPosition(new Vec3(x, y, 0));
    }
    protected update(dt: number): void {
        // 计时器累加这一帧的秒数
        this._timer += dt
        while (this._timer > this.spawnInterval) {
            this._timer -= this.spawnInterval
            //生成一个敌人
            this.spawOne()
        }

    }


}

