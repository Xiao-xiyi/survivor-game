import { _decorator, Component, math, Prefab, Vec3 } from 'cc';
import { getNode } from './pool';
import { GameState } from './GameState';
import { Player } from './Player';
import { Enemy } from './Enemy';

const { ccclass, property } = _decorator;

/**
 * 敌人生成器：负责按时间刷小怪、按概率刷远程怪、按间隔刷 Boss
 * 难度曲线也在这里：存活越久，刷怪间隔越短
 */
@ccclass('EnemySpawner')
export class EnemySpawner extends Component {

    // ==================== 一、可配置属性 ====================

    @property({ type: Prefab, tooltip: '普通敌人（近战）的预制体' })
    enemy: Prefab = null

    @property({ type: Prefab, tooltip: '远程怪的预制体' })
    shooterPrefab: Prefab = null

    @property({ tooltip: '远程怪出现概率 0~1' })
    shooterChance: number = 0.35

    @property({ type: Prefab, tooltip: 'Boss 预制体' })
    bossPrefab: Prefab = null

    @property({ tooltip: '每隔多少秒刷一只 Boss' })
    bossInterval: number = 90

    @property({ tooltip: '初始生成间隔（秒），会随时间变短' })
    spawnInterval: number = 1.2

    @property({ tooltip: '生成半径，要大于屏幕半对角线，保证从屏幕外出生' })
    spawnRadius: number = 2100

    @property({ tooltip: '同屏敌人上限，超过就不再刷（性能护栏）' })
    maxEnemies: number = 120

    // ==================== 二、私有状态 ====================

    /** 普通怪计时器 */
    private _timer: number = 0

    /** Boss 计时器，和普通刷怪计时器互不干扰 */
    private _bossTimer: number = 0

    // ==================== 三、每帧逻辑 ====================

    protected update(dt: number): void {
        if (!GameState.started) return   // 还在开始界面
        if (GameState.paused) return     // 暂停中
        if (GameState.over) return       // 游戏结束，别再刷怪

        // ---- 普通怪：间隔随存活时间变短，最快 0.45 秒一个 ----
        const cur = Math.max(0.45, this.spawnInterval - GameState.time * 0.02)
        this._timer += dt
        // 用 while 而不是 if：掉帧时一帧可能要补刷好几只
        while (this._timer > cur) {
            this._timer -= cur
            this.spawnOne()
        }

        // ---- Boss：固定间隔 ----
        if (this.bossPrefab) {
            this._bossTimer += dt
            if (this._bossTimer >= this.bossInterval) {
                this._bossTimer = 0
                this.spawnBoss()
            }
        }
    }

    // ==================== 四、内部逻辑 ====================

    /**
     * 随机出生点：以玩家为圆心、spawnRadius 为半径的圆上取一点
     * 以玩家为圆心而不是世界原点，否则玩家走到地图边缘时怪会贴脸刷出来
     */
    private randomSpawnPos(): Vec3 {
        const center = Player.instance?.node.position ?? Vec3.ZERO
        const angleRad = math.toRadian(Math.random() * 360)   // 度 → 弧度
        return new Vec3(
            center.x + Math.cos(angleRad) * this.spawnRadius,
            center.y + Math.sin(angleRad) * this.spawnRadius,
            0
        )
    }

    /** 刷一只普通怪（按概率决定是近战还是远程） */
    private spawnOne(): void {
        // 性能护栏：场上的敌人已经够多了就不再刷
        // 否则玩家不打怪时，敌人会无限堆积，drawcall 和逻辑开销一起涨
        if (Enemy.all.length >= this.maxEnemies) return

        // 掷骰子：配了远程预制体、且随机数小于概率 → 这次刷远程怪
        const useShooter = this.shooterPrefab && Math.random() < this.shooterChance
        const prefab = useShooter ? this.shooterPrefab : this.enemy
        if (!prefab) return

        const enemy = getNode(prefab)
        // 挂到生成器的父节点下（敌人不该是生成器的子节点，否则会跟着生成器一起动）
        const parent = this.node.parent ?? this.node
        this.node.addChild(enemy)
        enemy.setWorldPosition(this.randomSpawnPos())
    }

    /** 刷一只 Boss */
    private spawnBoss(): void {
        if (!this.bossPrefab) return

        const boss = getNode(this.bossPrefab)
        const parent = this.node.parent ?? this.node
        this.node.addChild(boss)
        boss.setWorldPosition(this.randomSpawnPos())
    }
}