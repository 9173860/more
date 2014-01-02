var character = require('../util/character'),
	Class = require('../util/Class'),
	Node = Class(function(id, params, body, fhash) {
		this.id = id;
		this.params = params; //�β�����
		this.body = body; //������
		this.fhash = fhash; //�β��ں������е�λ��hash
		this.gvs = {}; //ȫ�ֱ���
	}).methods({
		compile: function(aparams, gvs) {
			var self = this;
			self.global(gvs);
			var res = this.body;
			//������λ�ñ����滻Ϊֵ
			Object.keys(self.fhash).reverse().forEach(function(pos) {
				var o = self.fhash[pos];
				//�ֲ�����������ȫ�ֱ���
				var v = aparams[o.index];
				if(character.isUndefined(v)) {
					var va = o.v.replace(/^\$/, '');
					if(self.gvs.hasOwnProperty(va)) {
						v = self.gvs[va];
					}
				}
				if(character.isUndefined(v)) {
					console.error('@function ' + self.id + ': ' + o.v + ' is undefined');
					v = '';
				}
				res = res.slice(0, pos) + v + res.slice(parseInt(pos) + o.v.length);
			});
			return res;
		},
		global: function(gvs) {
			if(!character.isUndefined(gvs)) {
				this.gvs = gvs;
			}
			return this.gvs;
		}
	});
module.exports = Node;
