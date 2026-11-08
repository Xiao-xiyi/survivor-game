import { _decorator, Component, math, Prefab, Vec3 } from 'cc';
// 从 pool.ts 引入对象池的取出函数
import { getNode } from './pool';
import { GameState } from './GameState';
const { ccclass, property } = _decorator;

@ccclass('EnemySpawner')
export class EnemySpawner extends Component {
    @property({ type: Prefab, tooltip: '敌人的预制体' })
    enemy: Prefab = null
    @property({ tooltip: '生成间隔' })
    spawnInterval: number = 1.2
    @property({ tooltip: '生成半径，要大于 2000 让敌人从屏幕外进来' })
    spawnRadius: number = 2100;
    private _timer: number = 0;
    private spawOne(): void {
        if (!this.enemy) return
        // 从对象池拿一个敌人节点
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
        if (!GameState.started) return  
        if (GameState.over) return       // 游戏结束，别再刷怪
        const cur = Math.max(0.45, this.spawnInterval - GameState.time * 0.02)
        // 计时器累加这一帧的秒数
        this._timer += dt
        while (this._timer > cur) {
            this._timer -= cur
            //生成一个敌人
            this.spawOne()
        }

    }


}

