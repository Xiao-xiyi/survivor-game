import { _decorator, Component, Label, Node, tween, Tween, UIOpacity, Vec3 } from 'cc';
import { putNode } from './pool'
const { ccclass, property } = _decorator;

@ccclass('Dmgpopup')
export class Dmgpopup extends Component {
     init(dmg: number, x: number, y: number) {
        // 从池里拿出来的节点是"脏"的：可能停在半路、透明度还是 0，先全部复位
        Tween.stopAllByTarget(this.node)
        this.node.setPosition(x, y, 0)
        this.node.setScale(1, 1, 1)
        const op = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity)
        op.opacity = 255

        this.getComponent(Label).string = `-${dmg}`

        tween(this.node)                      // 往上飘 50 像素
            .by(0.5, { position: new Vec3(0, 50, 0) })
            .start()
        tween(op)                             // 后半段淡出
            .delay(0.25)
            .to(0.25, { opacity: 0 })
            .start()

        // 0.6 秒后回收（比动画略长一点，让动画播完）
        this.scheduleOnce(() => putNode(this.node), 0.6)
    }
}


