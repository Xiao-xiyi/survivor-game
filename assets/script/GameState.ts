// 全局游戏状态。模块级变量，全项目共享同一个对象
export const GameState = {
    // 游戏是否结束；true 时敌人、子弹、经验球全部停摆
    over: false,
    time: 0
}