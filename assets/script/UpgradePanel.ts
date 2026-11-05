import { _decorator, Component, director, EventKeyboard, Input, input, KeyCode, Label, log, Node } from 'cc';
const { ccclass, property } = _decorator;
import { Player } from './Player';

@ccclass('UpgradePanel')
export class UpgradePanel extends Component {
    // 静态实例，让 Player 能直接调用
    static instance: UpgradePanel = null
    @property({ type: Node, tooltip: '要显示/隐藏的面板节点' })
    panel: Node = null
    @property({ type: Label, tooltip: '显示三个选项的 Label' })
    optionLabel: Label = null
    // 面板是不是正开着
    private _showing: boolean = false



    protected onLoad(): void {
        UpgradePanel.instance = this                  
        if (this.panel) this.panel.active = false    
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this)  
    }

    protected onDestroy(): void {
        if (UpgradePanel.instance === this) UpgradePanel.instance = null
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this)
    }


    //player升级时调用
    public show() {

        if (this._showing) return
        //拿到玩家
        const p = Player.instance
        if (!p) return
        this._showing = true

        if (this.optionLabel) {
            this.optionLabel.string =
                `升级！选择一项强化\n\n` +
                `1. 伤害+1      (当前${p.baseDamage + p.damageBonus})\n` +
                `2. 攻速 +25%     （当前 ${(1 / p.fireInterval).toFixed(1)} 发/秒）\n` +
                `3. 移速 +15%     （当前 ${p.speed} 像素/秒）`
        }
        if (this.panel)
            this.panel.active = true
        //冻结游戏
        director.pause()
    }
    private onKeyDown(e: EventKeyboard): void {
        if (!this._showing) return
        switch (e.keyCode) {
            case KeyCode.DIGIT_1: this.apply(0);break
            case KeyCode.DIGIT_2: this.apply(1);break
            case KeyCode.DIGIT_3: this.apply(2);break
        }

    }
    apply(i: number) {
        const p = Player.instance
        if (!p) return
        switch (i) {
            case 0: p.damageBonus += 1;break
            case 1: p.fireInterval = Math.max(0.08, p.fireInterval * 0.75);break
            case 2: p.speed *= 1.15;break

        }
        // 关面板
        if (this.panel) this.panel.active = false
        this._showing = false
        director.resume()

    }
}


