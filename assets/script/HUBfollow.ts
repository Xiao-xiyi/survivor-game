import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('HudFollow')
export class HudFollow extends Component {
    @property({ type: Node, tooltip: '要跟随的相机节点' })
    cam: Node = null

    @property({ tooltip: '相对屏幕中心的横向偏移' })
    offsetX: number = -500

    @property({ tooltip: '相对屏幕中心的纵向偏移' })
    offsetY: number = 300

    // lateUpdate 在所有 update 之后执行，保证相机已经动完了我们再动
    protected lateUpdate(dt: number): void {
        if (!this.cam) return

        // 相机和 HUD 都是 Canvas 的子节点，本地坐标可以直接比
        const c = this.cam.position
        this.node.setPosition(
            c.x + this.offsetX,
            c.y + this.offsetY,
            this.node.position.z
        )
    }
}