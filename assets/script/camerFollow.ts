import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('camerFollow')
export class camerFollow extends Component {
   
    @property({ type: Node, tooltip: '要跟随的目标节点' })
    target: Node = null
    protected lateUpdate(dt: number): void {
        
        // 如果没设目标，或者目标已销毁，就不动
        if (!this.target || !this.target.isValid) return
        // 获取目标位置
        const p = this.target.position
        // 把摄像机父节点（CameraTarget）移到玩家位置，Main Camera 是子节点，跟着走
        this.node.setPosition(p.x, p.y, this.node.position.z)
    }


}
